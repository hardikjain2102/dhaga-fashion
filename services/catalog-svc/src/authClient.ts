import type { Config } from "./config";
import { HttpError } from "./errors";

// Asks auth-svc for the seller's CURRENT status. Returns null if there is no such seller.
// If auth-svc cannot be reached the answer is "unknown", and unknown means NO (fail closed).
export async function fetchSellerStatus(cfg: Config, sellerId: string): Promise<string | null> {
  const unavailable = new HttpError(503, "Cannot verify your seller status right now. Please try again shortly.");
  let res: Response;
  try {
    res = await fetch(`${cfg.authServiceUrl}/internal/sellers/${encodeURIComponent(sellerId)}/status`, {
      headers: { "x-internal-secret": cfg.internalSecret },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw unavailable;
  }
  if (res.status === 404) return null;
  if (!res.ok) throw unavailable;
  const body = (await res.json()) as { status?: unknown };
  return typeof body.status === "string" ? body.status : null;
}
