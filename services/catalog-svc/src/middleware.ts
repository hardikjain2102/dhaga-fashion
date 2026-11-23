import crypto from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { fetchSellerStatus } from "./authClient";
import type { Config } from "./config";
import { HttpError } from "./errors";
import { verifyAccess, type AccessClaims } from "./tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

export const requireAuth =
  (cfg: Config): RequestHandler =>
  (req, _res, next) => {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) return next(new HttpError(401, "Authentication required."));
    try {
      req.auth = verifyAccess(cfg, header.slice(7));
      next();
    } catch {
      next(new HttpError(401, "Invalid or expired token."));
    }
  };

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) =>
    req.auth && roles.includes(req.auth.role) ? next() : next(new HttpError(403, "Forbidden."));

// The token only says "this person WAS a seller when it was issued". Before any seller write we ask
// auth-svc whether they are STILL approved. Admins skip this check.
export const requireApprovedSeller =
  (cfg: Config): RequestHandler =>
  (req, _res, next) => {
    const auth = req.auth;
    if (!auth) return next(new HttpError(401, "Authentication required."));
    if (auth.role === "admin") return next();
    fetchSellerStatus(cfg, auth.sub)
      .then((status) => {
        if (status === "approved") return next();
        const msg =
          status === "suspended"
            ? "Your seller account is suspended."
            : status === "pending"
            ? "Your seller account is awaiting admin approval."
            : "Forbidden.";
        next(new HttpError(403, msg));
      })
      .catch(next);
  };

const digest = (s: string) => crypto.createHash("sha256").update(s).digest();

// Service-to-service calls must present the shared secret.
export const requireInternal =
  (cfg: Config): RequestHandler =>
  (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const provided = req.header("x-internal-secret");
    const ok = typeof provided === "string" && crypto.timingSafeEqual(digest(provided), digest(cfg.internalSecret));
    if (!ok) return next(new HttpError(401, "Unauthorized."));
    next();
  };

export const errorHandler =
  (log: Logger): ErrorRequestHandler =>
  (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Invalid input.",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Malformed JSON." });
      return;
    }
    if (err?.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large." });
      return;
    }
    // Never send internals to the client. The message goes to the log with the request ID.
    log.error({ err: err?.message, requestId: req.header("x-request-id") ?? "-" }, "unhandled error");
    res.status(500).json({ error: "Internal server error." });
  };
