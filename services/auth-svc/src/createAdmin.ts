// Creates the first admin account. Idempotent: if the email already exists, nothing changes.
// Development: run by hand. Kubernetes: a one-time Job with the values mounted from a Secret.
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { readSecret, requireSecret } from "./config";

async function main() {
  const email = requireSecret("ADMIN_EMAIL").trim().toLowerCase();
  const name = readSecret("ADMIN_NAME") ?? "Administrator";
  const password = requireSecret("ADMIN_PASSWORD");

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("ADMIN_EMAIL is not a valid email");
  if (password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error("ADMIN_PASSWORD must be 12 to 72 bytes long");
  }

  const pool = new Pool({ connectionString: requireSecret("DATABASE_URL") });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
      [name, email, hash]
    );
    console.log(
      result.rowCount ? `Admin created: ${email}` : `An account for ${email} already exists. Nothing changed.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("create-admin failed:", err.message);
  process.exit(1);
});
