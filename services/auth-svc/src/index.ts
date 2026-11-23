import pino from "pino";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createPool } from "./db";

const cfg = loadConfig();
const log = pino({ name: "auth-svc", level: cfg.logLevel });
const pool = createPool(cfg.databaseUrl);
pool.on("error", (err) => log.error({ err: err.message }, "idle database client error"));

const app = buildApp(cfg, pool, log);
const server = app.listen(cfg.port, () => log.info({ port: cfg.port }, "listening"));

// Graceful shutdown so rolling updates do not drop requests.
const shutdown = (signal: string) => {
  log.info({ signal }, "shutting down");
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
