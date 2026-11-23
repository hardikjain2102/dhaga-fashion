// Service-to-service endpoints. NOT exposed through the Ingress (it routes /api/* only), and
// additionally protected by a shared secret, so being inside the cluster is not enough.
import crypto from "node:crypto";
import { Router, type Request, type RequestHandler, type Response } from "express";
import type { Pool } from "pg";
import type { Config } from "./config";
import { HttpError } from "./middleware";
import { idSchema } from "./schemas";

const digest = (s: string) => crypto.createHash("sha256").update(s).digest();

const ah =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function internalRouter(cfg: Config, pool: Pool): Router {
  const r = Router();

  r.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const provided = req.header("x-internal-secret");
    // Hashing first gives equal-length buffers, and timingSafeEqual avoids leaking how much matched.
    const ok = typeof provided === "string" && crypto.timingSafeEqual(digest(provided), digest(cfg.internalSecret));
    if (!ok) return next(new HttpError(401, "Unauthorized."));
    next();
  });

  // "Is this seller still approved?" Read live from the database, so it is never stale.
  r.get(
    "/sellers/:id/status",
    ah(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const result = await pool.query("SELECT seller_status FROM users WHERE id = $1 AND role = 'seller'", [id]);
      if (!result.rows[0]) throw new HttpError(404, "Seller not found.");
      res.json({ status: result.rows[0].seller_status });
    })
  );

  return r;
}
