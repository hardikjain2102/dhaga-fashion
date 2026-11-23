import fs from "node:fs";

// Reads NAME from the environment, or from the file named by NAME_PATH
// (a Kubernetes Secret mounted as a file). One trailing newline is removed.
export function readSecret(name: string): string | undefined {
  const direct = process.env[name];
  if (direct) return direct;
  const file = process.env[`${name}_PATH`];
  if (file) return fs.readFileSync(file, "utf8").replace(/\r?\n$/, "");
  return undefined;
}

export function requireSecret(name: string): string {
  const value = readSecret(name);
  if (!value) throw new Error(`Missing configuration: set ${name} or ${name}_PATH`);
  return value;
}

export function parseDuration(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value);
  if (!m) throw new Error(`Invalid duration "${value}" (use 30s, 15m, 12h or 7d)`);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as "s" | "m" | "h" | "d"];
  return Number(m[1]) * unit;
}

export interface Config {
  port: number;
  logLevel: string;
  databaseUrl: string;
  privateKey: string;
  publicKey: string;
  accessTtl: number; // seconds
  refreshTtl: number; // seconds
  cookieSecure: boolean;
  trustProxy: number; // number of proxies in front (the Ingress is 1)
  rateLimitMax: number;
  internalSecret: string; // shared with services that call /internal/*
}

export function loadConfig(): Config {
  const internalSecret = requireSecret("INTERNAL_API_SECRET");
  if (internalSecret.length < 32) throw new Error("INTERNAL_API_SECRET must be at least 32 characters");
  return {
    port: Number(process.env.PORT ?? 8080),
    logLevel: process.env.LOG_LEVEL ?? "info",
    databaseUrl: requireSecret("DATABASE_URL"),
    privateKey: requireSecret("JWT_PRIVATE_KEY"),
    publicKey: requireSecret("JWT_PUBLIC_KEY"),
    accessTtl: parseDuration(process.env.ACCESS_TOKEN_TTL ?? "15m"),
    refreshTtl: parseDuration(process.env.REFRESH_TOKEN_TTL ?? "7d"),
    cookieSecure: (process.env.COOKIE_SECURE ?? "true") === "true",
    trustProxy: Number(process.env.TRUST_PROXY ?? 0),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 20),
    internalSecret,
  };
}
