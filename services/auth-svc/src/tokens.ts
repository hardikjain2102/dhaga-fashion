import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Config } from "./config";
import type { Role, UserRow } from "./types";

export const ISSUER = "dhaga-auth";
export const AUDIENCE = "dhaga-api";

export interface AccessClaims {
  sub: string;
  role: Role;
  name: string;
}

const isRole = (v: unknown): v is Role => v === "customer" || v === "seller" || v === "admin";

export function signAccess(cfg: Config, user: UserRow): string {
  return jwt.sign({ role: user.role, name: user.name }, cfg.privateKey, {
    algorithm: "RS256",
    subject: user.id,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: cfg.accessTtl,
  });
}

// The algorithm is pinned: "none" and HS256 tokens are rejected.
export function verifyAccess(cfg: Config, token: string): AccessClaims {
  const payload = jwt.verify(token, cfg.publicKey, {
    algorithms: ["RS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === "string" || !payload.sub || !isRole(payload.role) || typeof payload.name !== "string") {
    throw new Error("unexpected token claims");
  }
  return { sub: payload.sub, role: payload.role, name: payload.name };
}

export const hashToken = (raw: string): string => crypto.createHash("sha256").update(raw).digest("hex");

export function newRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}
