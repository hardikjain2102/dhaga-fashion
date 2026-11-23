import express from "express";
import helmet from "helmet";
import type { Pool } from "pg";
import type { Logger } from "pino";
import type { Config } from "./config";
import { HttpError } from "./errors";
import { internalRouter } from "./internal";
import { errorHandler } from "./middleware";
import { productsRouter } from "./routes";

export function buildApp(cfg: Config, pool: Pool, log: Logger) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "50kb" }));

  // One log line per request, tagged with the request ID the Ingress adds. Paths only, never bodies or headers.
  app.use((req, res, next) => {
    if (req.path === "/healthz" || req.path === "/readyz") return next();
    const requestId = req.header("x-request-id") ?? "-";
    res.on("finish", () => {
      log.info({ requestId, method: req.method, path: req.path, status: res.statusCode }, "request");
    });
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "catalog-svc" });
  });

  // Ready only when the database answers. (auth-svc is deliberately not checked: browsing works without it.)
  app.get("/readyz", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "ready", service: "catalog-svc" });
    } catch {
      res.status(503).json({ status: "database unavailable", service: "catalog-svc" });
    }
  });

  app.use("/api/products", productsRouter(cfg, pool, log));
  app.use("/internal", internalRouter(cfg, pool)); // never routed by the Ingress

  app.use((_req, _res, next) => next(new HttpError(404, "Not found.")));
  app.use(errorHandler(log));
  return app;
}
