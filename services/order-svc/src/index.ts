import express from "express";
import pino from "pino";

const SERVICE_NAME = "order-svc";
const PORT = Number(process.env.PORT ?? 8080);
const log = pino({ name: SERVICE_NAME, level: process.env.LOG_LEVEL ?? "info" });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// One log line per request, tagged with the request ID the Ingress adds.
app.use((req, res, next) => {
  if (req.path === "/healthz" || req.path === "/readyz") return next();
  const requestId = req.header("x-request-id") ?? "-";
  res.on("finish", () => {
    log.info(
      { requestId, method: req.method, path: req.path, status: res.statusCode },
      "request"
    );
  });
  next();
});

// Liveness: the process is up.
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", service: SERVICE_NAME });
});

// Readiness: ready for traffic. Dependency checks (DB, Redis, RabbitMQ) come in M5/M6.
app.get("/readyz", (_req, res) => {
  res.status(200).json({ status: "ready", service: SERVICE_NAME });
});

const server = app.listen(PORT, () => {
  log.info({ port: PORT }, "listening");
});

// Graceful shutdown so rolling updates do not drop requests.
const shutdown = (signal: string) => {
  log.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
