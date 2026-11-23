import bcrypt from "bcryptjs";
import { Router, type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";
import type { Pool } from "pg";
import type { Logger } from "pino";
import type { Config } from "./config";
import { HttpError, requireAuth, requireRole } from "./middleware";
import { idSchema, loginSchema, signupSchema, statusSchema } from "./schemas";
import { hashToken, newRefreshToken, signAccess } from "./tokens";
import type { UserRow } from "./types";

const COOKIE = "dhaga_rt";
const BCRYPT_COST = 12;
// Used when the email is unknown, so the response takes the same time as a real password check.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

// Express 4 does not catch errors from async handlers, so this wrapper passes them on.
const ah =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

const toDto = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  ...(u.seller_status ? { sellerStatus: u.seller_status } : {}),
});

export function authRouter(cfg: Config, pool: Pool, log: Logger): Router {
  const r = Router();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: cfg.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later." },
  });

  const cookieOpts = { httpOnly: true, secure: cfg.cookieSecure, sameSite: "strict" as const, path: "/api/auth" };
  const clearCookie = (res: Response) => res.clearCookie(COOKIE, cookieOpts);

  async function createSession(user: UserRow) {
    const refresh = newRefreshToken();
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(secs => $3))`,
      [user.id, refresh.hash, cfg.refreshTtl]
    );
    return {
      refreshRaw: refresh.raw,
      body: { accessToken: signAccess(cfg, user), expiresIn: cfg.accessTtl, user: toDto(user) },
    };
  }

  function sendSession(res: Response, status: number, s: Awaited<ReturnType<typeof createSession>>) {
    res.cookie(COOKIE, s.refreshRaw, { ...cookieOpts, maxAge: cfg.refreshTtl * 1000 });
    res.status(status).json(s.body);
  }

  r.post(
    "/signup",
    limiter,
    ah(async (req, res) => {
      const body = signupSchema.parse(req.body);
      const hash = await bcrypt.hash(body.password, BCRYPT_COST);
      let user: UserRow;
      try {
        const result = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, seller_status)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [body.name, body.email, hash, body.role, body.role === "seller" ? "pending" : null]
        );
        user = result.rows[0];
      } catch (err) {
        if ((err as { code?: string }).code === "23505") {
          throw new HttpError(409, "An account with this email already exists.");
        }
        throw err;
      }
      sendSession(res, 201, await createSession(user));
    })
  );

  r.post(
    "/login",
    limiter,
    ah(async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      const user: UserRow | undefined = result.rows[0];
      const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !ok) throw new HttpError(401, "Invalid email or password.");
      if (user.role === "seller" && user.seller_status === "suspended") {
        throw new HttpError(403, "This seller account is suspended.");
      }
      sendSession(res, 200, await createSession(user));
    })
  );

  r.post(
    "/refresh",
    ah(async (req, res) => {
      const raw: unknown = req.cookies?.[COOKIE];
      if (typeof raw !== "string" || raw.length === 0) throw new HttpError(401, "No session.");

      const client = await pool.connect();
      let user: UserRow | undefined;
      let failure = "Session expired.";
      try {
        await client.query("BEGIN");
        const found = await client.query(
          `SELECT id, user_id,
                  expires_at < now() AS expired,
                  revoked_at IS NOT NULL AS revoked,
                  revoked_at < now() - interval '10 seconds' AS stale_reuse
             FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
          [hashToken(raw)]
        );
        const tok = found.rows[0];
        if (!tok) {
          failure = "Session not found.";
        } else if (tok.revoked) {
          // A token that was already used is being presented again: possible theft.
          // The 10-second grace window covers two browser tabs refreshing at the same moment.
          if (tok.stale_reuse) {
            await client.query(
              "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
              [tok.user_id]
            );
          }
        } else if (!tok.expired) {
          await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [tok.id]);
          const u = await client.query("SELECT * FROM users WHERE id = $1", [tok.user_id]);
          const row: UserRow | undefined = u.rows[0];
          if (row && !(row.role === "seller" && row.seller_status === "suspended")) user = row;
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }

      if (!user) {
        clearCookie(res);
        throw new HttpError(401, failure);
      }
      sendSession(res, 200, await createSession(user));
    })
  );

  r.post(
    "/logout",
    ah(async (req, res) => {
      const raw: unknown = req.cookies?.[COOKIE];
      if (typeof raw === "string" && raw.length > 0) {
        await pool.query(
          "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
          [hashToken(raw)]
        );
      }
      clearCookie(res);
      res.status(204).end();
    })
  );

  r.get(
    "/me",
    requireAuth(cfg),
    ah(async (req, res) => {
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.auth!.sub]);
      if (!result.rows[0]) throw new HttpError(401, "Account no longer exists.");
      res.json(toDto(result.rows[0]));
    })
  );

  // ---------- admin only ----------
  r.get(
    "/users",
    requireAuth(cfg),
    requireRole("admin"),
    ah(async (_req, res) => {
      const result = await pool.query("SELECT * FROM users ORDER BY created_at LIMIT 500");
      res.json(result.rows.map(toDto));
    })
  );

  r.patch(
    "/users/:id/seller-status",
    requireAuth(cfg),
    requireRole("admin"),
    ah(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { status } = statusSchema.parse(req.body);

      const found = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
      const target: UserRow | undefined = found.rows[0];
      if (!target) throw new HttpError(404, "User not found.");
      if (target.role !== "seller") throw new HttpError(400, "Only seller accounts have an approval status.");
      if (target.seller_status === status) throw new HttpError(409, `This seller is already ${status}.`);

      const updated = await pool.query("UPDATE users SET seller_status = $2 WHERE id = $1 RETURNING *", [id, status]);
      if (status === "suspended") {
        await pool.query(
          "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
          [id]
        );
      }
      // Audit line: who changed whose status.
      log.info({ actor: req.auth?.sub, target: id, status }, "seller status changed");
      res.json(toDto(updated.rows[0]));
    })
  );

  return r;
}
