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

export interface Config {
  port: number;
  logLevel: string;
  databaseUrl: string;
  publicKey: string; // verifies tokens; catalog-svc can never create them
  authServiceUrl: string;
  internalSecret: string;
}

export function loadConfig(): Config {
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  if (!authServiceUrl) throw new Error("Missing configuration: set AUTH_SERVICE_URL");
  const internalSecret = requireSecret("INTERNAL_API_SECRET");
  if (internalSecret.length < 32) throw new Error("INTERNAL_API_SECRET must be at least 32 characters");
  return {
    port: Number(process.env.PORT ?? 8080),
    logLevel: process.env.LOG_LEVEL ?? "info",
    databaseUrl: requireSecret("DATABASE_URL"),
    publicKey: requireSecret("JWT_PUBLIC_KEY"),
    authServiceUrl: authServiceUrl.replace(/\/+$/, ""),
    internalSecret,
  };
}
