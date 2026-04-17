// Raw-SQL migration runner.
//
// The drizzle-kit migrator (server/migrate.ts) expects files generated
// by `drizzle-kit generate` with a meta/_journal.json manifest. Our
// migrations under ./migrations/*.sql are hand-rolled against Drizzle's
// schema.ts — they don't play nicely with the drizzle migrator, so we
// run them here with plain SQL instead.
//
// Tracks applied migrations in a _raw_migrations table so re-runs are
// idempotent. Each file is applied inside a transaction — partial
// failures roll back rather than leaving a half-migrated DB.
//
// Usage:
//   DATABASE_URL=postgres://… npm run db:migrate:raw
//
// Contract for new migration files:
//   - Named `NNNN_description.sql` under ./migrations/
//   - Down migrations use the suffix `_down.sql` — skipped by this
//     runner (apply manually if a rollback is needed)
//   - Each file should be safe to re-apply (use `IF NOT EXISTS` on
//     ALTERs, etc.) since a failed mid-file run leaves the row not yet
//     tracked and the runner will retry next time.

import dotenv from "dotenv";
dotenv.config();

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

const MIGRATIONS_DIR = resolve(process.cwd(), "migrations");

async function ensureTrackingTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _raw_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM _raw_migrations ORDER BY name"
  );
  return new Set(rows.map((r) => r.name));
}

function pendingMigrations(applied: Set<string>): string[] {
  const all = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.endsWith(".sql") && !f.endsWith("_down.sql"),
  );
  all.sort();
  return all.filter((name) => !applied.has(name));
}

async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    console.error("Set it to the Postgres connection string of the target DB, e.g.");
    console.error('  DATABASE_URL="postgres://user:pass@host:5432/dbname" npm run db:migrate:raw');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Managed Postgres (Azure, Neon, etc.) typically uses TLS with
    // certs that aren't in the default Node trust store. `rejectUnauthorized:
    // false` matches what server/index.ts does; tighten later by shipping
    // the CA cert through DATABASE_SSL_CA env if you want verified TLS.
    ssl: process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });

  try {
    await ensureTrackingTable(pool);
    const applied = await appliedMigrations(pool);

    console.log(`Previously applied: ${applied.size}`);
    for (const name of applied) console.log(`  ✓ ${name}`);

    const pending = pendingMigrations(applied);
    if (pending.length === 0) {
      console.log("\nNothing to apply. Database is up to date.");
      return;
    }

    console.log(`\nPending (${pending.length}):`);
    for (const name of pending) console.log(`  • ${name}`);
    console.log("");

    for (const name of pending) {
      const sqlPath = resolve(MIGRATIONS_DIR, name);
      const sql = readFileSync(sqlPath, "utf-8");
      process.stdout.write(`  Applying ${name}… `);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO _raw_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        console.log("✓");
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("✗");
        throw new Error(`Failed to apply ${name}: ${(err as Error).message}`);
      } finally {
        client.release();
      }
    }

    console.log(`\nApplied ${pending.length} migration(s). Database is up to date.`);
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("\nMigration run failed:", err.message || err);
  process.exit(1);
});
