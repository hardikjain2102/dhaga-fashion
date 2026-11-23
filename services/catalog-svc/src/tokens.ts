// Verification only. catalog-svc holds the PUBLIC key, so it can check tokens but never create one.
import jwt from "jsonwebtoken";
import type { Config } from "./config";

export const ISSUER = "dhaga-auth";
export const AUDIENCE = "dhaga-api";

export type Role = "customer" | "seller" | "admin";
export interface AccessClaims {
  sub: string;
  role: Role;
  name: string;
}

const isRole = (v: unknown): v is Role => v === "customer" || v === "seller" || v === "admin";

// The algorithm is pinned: "none" and HS256 tokens are rejected.
export function verifyAccess(cfg: Config, token: string): AccessClaims {
  const payload = jwt.verify(token, cfg.publicKey, { algorithms: ["RS256"], issuer: ISSUER, audience: AUDIENCE });
  if (typeof payload === "string" || !payload.sub || !isRole(payload.role) || typeof payload.name !== "string") {
    throw new Error("unexpected token claims");
  }
  return { sub: payload.sub, role: payload.role, name: payload.name };
}
