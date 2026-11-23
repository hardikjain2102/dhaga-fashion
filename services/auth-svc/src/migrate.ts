// Applies migrations/*.sql in order, once each. Safe to run repeatedly and from several pods at once
// (an advisory lock makes the others wait). In Kubernetes this runs as a Job before each deploy.
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { requireSecret } from "./config";

const LOCK_ID = 727001;

async function main() {
  const pool = new Pool({ connectionString: requireSecret("DATABASE_URL") });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );
    const dir = path.join(__dirname, "..", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (done.rowCount) {
        console.log(`skip   ${file}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("migration failed:", err.message);
  process.exit(1);
});
