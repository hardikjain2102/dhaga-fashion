import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { Pool } from "pg";
import type { Logger } from "pino";
import type { Config } from "./config";
import { HttpError, errorHandler } from "./middleware";
import { authRouter } from "./routes";

export function buildApp(cfg: Config, pool: Pool, log: Logger) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", cfg.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  // One log line per request, tagged with the request ID the Ingress adds. Paths only, never bodies or headers.
  app.use((req, res, next) => {
    if (req.path === "/healthz" || req.path === "/readyz") return next();
    const requestId = req.header("x-request-id") ?? "-";
    res.on("finish", () => {
      log.info({ requestId, method: req.method, path: req.path, status: res.statusCode }, "request");
    });
    next();
  });

  // Liveness: the process is up.
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "auth-svc" });
  });

  // Readiness: only ready for traffic when the database answers.
  app.get("/readyz", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "ready", service: "auth-svc" });
    } catch {
      res.status(503).json({ status: "database unavailable", service: "auth-svc" });
    }
  });

  app.use(
    "/api/auth",
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store"); // responses can contain tokens
      next();
    },
    authRouter(cfg, pool, log)
  );

  app.use((_req, _res, next) => next(new HttpError(404, "Not found.")));
  app.use(errorHandler(log));
  return app;
}
