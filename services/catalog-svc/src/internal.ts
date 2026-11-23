// Service-to-service stock operations used by order-svc during checkout. Never routed by the Ingress.
import { Router, type Request, type RequestHandler, type Response } from "express";
import type { Pool } from "pg";
import type { Config } from "./config";
import { withTx } from "./db";
import { HttpError } from "./errors";
import { requireInternal } from "./middleware";
import { orderRefSchema, reserveSchema } from "./schemas";

const ah =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

interface StoredItem {
  productId: string;
  size: string;
  quantity: number;
}

// Locking rows in the same order in every transaction means two checkouts can never deadlock.
const sorted = <T extends { productId: string; size: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.productId.localeCompare(b.productId) || a.size.localeCompare(b.size));

export function internalRouter(cfg: Config, pool: Pool): Router {
  const r = Router();
  r.use(requireInternal(cfg));

  // All or nothing: either every line is reserved, or the transaction rolls back and nothing changes.
  r.post(
    "/stock/reserve",
    ah(async (req, res) => {
      const { orderId, items } = reserveSchema.parse(req.body);
      const snapshot = await withTx(pool, async (c) => {
        const claim = await c.query(
          `INSERT INTO stock_reservations (order_id, status, items) VALUES ($1, 'reserved', '[]'::jsonb)
           ON CONFLICT (order_id) DO NOTHING RETURNING order_id`,
          [orderId]
        );
        if (!claim.rows[0]) throw new HttpError(409, "Stock for this order is already reserved.");

        const lines = [];
        for (const item of sorted(items)) {
          // FOR UPDATE: a second buyer waits here until this transaction finishes, then sees the new stock.
          const row = await c.query(
            `SELECT s.stock, p.name, p.price, p.seller_id, p.seller_name
               FROM product_sizes s JOIN products p ON p.id = s.product_id
              WHERE s.product_id = $1 AND s.size = $2
                FOR UPDATE OF s`,
            [item.productId, item.size]
          );
          if (!row.rows[0]) throw new HttpError(404, `Product or size not found (${item.size}).`);
          const { stock, name, price, seller_id, seller_name } = row.rows[0];
          if (stock < item.quantity) {
            throw new HttpError(409, `${name} (${item.size}): only ${stock} left.`);
          }
          await c.query("UPDATE product_sizes SET stock = stock - $3 WHERE product_id = $1 AND size = $2", [
            item.productId,
            item.size,
            item.quantity,
          ]);
          lines.push({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
            name,
            unitPrice: price,
            sellerId: seller_id,
            sellerName: seller_name,
          });
        }
        const stored: StoredItem[] = lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity }));
        await c.query("UPDATE stock_reservations SET items = $2::jsonb, updated_at = now() WHERE order_id = $1", [
          orderId,
          JSON.stringify(stored),
        ]);
        return lines;
      });
      res.json({ orderId, status: "reserved", items: snapshot });
    })
  );

  // Payment succeeded: the stock is sold for good, and a later release can no longer give it back.
  r.post(
    "/stock/commit",
    ah(async (req, res) => {
      const { orderId } = orderRefSchema.parse(req.body);
      const status = await withTx(pool, async (c) => {
        const found = await c.query("SELECT status FROM stock_reservations WHERE order_id = $1 FOR UPDATE", [orderId]);
        if (!found.rows[0]) throw new HttpError(404, "No reservation for this order.");
        const current: string = found.rows[0].status;
        if (current === "released") throw new HttpError(409, "This reservation was already released.");
        if (current === "reserved") {
          await c.query("UPDATE stock_reservations SET status = 'committed', updated_at = now() WHERE order_id = $1", [
            orderId,
          ]);
        }
        return "committed";
      });
      res.json({ orderId, status });
    })
  );

  // Payment failed or timed out: stock goes back. Safe to call twice.
  r.post(
    "/stock/release",
    ah(async (req, res) => {
      const { orderId } = orderRefSchema.parse(req.body);
      const status = await withTx(pool, async (c) => {
        const found = await c.query("SELECT status, items FROM stock_reservations WHERE order_id = $1 FOR UPDATE", [
          orderId,
        ]);
        if (!found.rows[0]) throw new HttpError(404, "No reservation for this order.");
        const { status: current, items } = found.rows[0] as { status: string; items: StoredItem[] };
        if (current === "committed") throw new HttpError(409, "This order is paid; its stock cannot be released.");
        if (current === "reserved") {
          for (const item of sorted(items)) {
            // If the seller deleted the product meanwhile, there is no row and nothing to restore.
            await c.query(
              `UPDATE product_sizes SET stock = LEAST(stock + $3, 100000) WHERE product_id = $1 AND size = $2`,
              [item.productId, item.size, item.quantity]
            );
          }
          await c.query("UPDATE stock_reservations SET status = 'released', updated_at = now() WHERE order_id = $1", [
            orderId,
          ]);
        }
        return "released";
      });
      res.json({ orderId, status });
    })
  );

  return r;
}
