import { Router, type Request, type RequestHandler, type Response } from "express";
import type { Pool, PoolClient } from "pg";
import type { Logger } from "pino";
import type { Config } from "./config";
import { withTx } from "./db";
import { HttpError } from "./errors";
import { requireApprovedSeller, requireAuth, requireRole } from "./middleware";
import { idSchema, listQuerySchema, productSchema } from "./schemas";

// Express 4 does not catch errors from async handlers, so this wrapper passes them on.
const ah =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

// Product plus its sizes in the exact shape the frontend expects.
const SELECT = `
  SELECT p.id, p.name, p.category, p.price, p.description, p.swatch,
         p.seller_id AS "sellerId", p.seller_name AS "sellerName",
         COALESCE(json_agg(json_build_object('size', s.size, 'stock', s.stock) ORDER BY s.position)
                  FILTER (WHERE s.size IS NOT NULL), '[]'::json) AS sizes
    FROM products p
    LEFT JOIN product_sizes s ON s.product_id = p.id`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

async function getOne(db: Pool | PoolClient, id: string) {
  const result = await db.query(`${SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]);
  return result.rows[0];
}

async function writeSizes(client: PoolClient, productId: string, sizes: { size: string; stock: number }[]) {
  await client.query("DELETE FROM product_sizes WHERE product_id = $1 AND size <> ALL($2::text[])", [
    productId,
    sizes.map((s) => s.size),
  ]);
  for (let i = 0; i < sizes.length; i++) {
    await client.query(
      `INSERT INTO product_sizes (product_id, size, stock, position) VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock, position = EXCLUDED.position`,
      [productId, sizes[i].size, sizes[i].stock, i]
    );
  }
}

export function productsRouter(cfg: Config, pool: Pool, log: Logger): Router {
  const r = Router();
  const auth = requireAuth(cfg);
  const approvedSeller = requireApprovedSeller(cfg);

  // ---------- public reads ----------
  r.get(
    "/",
    ah(async (req, res) => {
      const { q, category, limit, offset } = listQuerySchema.parse(req.query);
      const where: string[] = [];
      const params: unknown[] = [];
      if (q) {
        params.push(`%${escapeLike(q)}%`);
        where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
      }
      if (category) {
        params.push(category);
        where.push(`p.category = $${params.length}`);
      }
      params.push(limit, offset);
      const sql = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
                   GROUP BY p.id ORDER BY p.created_at DESC, p.id
                   LIMIT $${params.length - 1} OFFSET $${params.length}`;
      res.json((await pool.query(sql, params)).rows);
    })
  );

  // Must be registered before "/:id", or "mine" would be read as an ID.
  r.get(
    "/mine",
    auth,
    requireRole("seller", "admin"),
    ah(async (req, res) => {
      const result = await pool.query(`${SELECT} WHERE p.seller_id = $1 GROUP BY p.id ORDER BY p.created_at DESC`, [
        req.auth!.sub,
      ]);
      res.json(result.rows);
    })
  );

  r.get(
    "/:id",
    ah(async (req, res) => {
      const product = await getOne(pool, idSchema.parse(req.params.id));
      if (!product) throw new HttpError(404, "Product not found.");
      res.json(product);
    })
  );

  // ---------- writes ----------
  // Only sellers create products. The owner comes from the verified token, never from the request body.
  r.post(
    "/",
    auth,
    requireRole("seller"),
    approvedSeller,
    ah(async (req, res) => {
      const body = productSchema.parse(req.body);
      const id = await withTx(pool, async (c) => {
        const ins = await c.query(
          `INSERT INTO products (seller_id, seller_name, name, category, price, description, swatch)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [req.auth!.sub, req.auth!.name, body.name, body.category, body.price, body.description, body.swatch]
        );
        await writeSizes(c, ins.rows[0].id, body.sizes);
        return ins.rows[0].id as string;
      });
      log.info({ actor: req.auth!.sub, product: id }, "product created");
      res.status(201).json(await getOne(pool, id));
    })
  );

  // Owner (approved seller) or admin (moderation). Everyone else gets 403.
  r.put(
    "/:id",
    auth,
    requireRole("seller", "admin"),
    approvedSeller,
    ah(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const body = productSchema.parse(req.body);
      await withTx(pool, async (c) => {
        const found = await c.query("SELECT seller_id FROM products WHERE id = $1 FOR UPDATE", [id]);
        if (!found.rows[0]) throw new HttpError(404, "Product not found.");
        if (req.auth!.role === "seller" && found.rows[0].seller_id !== req.auth!.sub) {
          throw new HttpError(403, "You can only edit your own products.");
        }
        await c.query(
          `UPDATE products SET name = $2, category = $3, price = $4, description = $5, swatch = $6, updated_at = now()
            WHERE id = $1`,
          [id, body.name, body.category, body.price, body.description, body.swatch]
        );
        await writeSizes(c, id, body.sizes);
      });
      log.info({ actor: req.auth!.sub, role: req.auth!.role, product: id }, "product updated");
      res.json(await getOne(pool, id));
    })
  );

  r.delete(
    "/:id",
    auth,
    requireRole("seller", "admin"),
    approvedSeller,
    ah(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const found = await pool.query("SELECT seller_id FROM products WHERE id = $1", [id]);
      if (!found.rows[0]) throw new HttpError(404, "Product not found.");
      if (req.auth!.role === "seller" && found.rows[0].seller_id !== req.auth!.sub) {
        throw new HttpError(403, "You can only delete your own products.");
      }
      await pool.query("DELETE FROM products WHERE id = $1", [id]);
      log.info({ actor: req.auth!.sub, role: req.auth!.role, product: id }, "product deleted");
      res.status(204).end();
    })
  );

  return r;
}
