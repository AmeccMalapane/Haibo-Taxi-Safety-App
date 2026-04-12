import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema";

const { Pool } = pg;

async function pushSchema() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const db = drizzle(pool, { schema });

  try {
    // Test connection
    const result = await db.execute(sql`SELECT NOW()`);
    console.log("Connected to database at:", result.rows[0].now);

    // Use drizzle-kit push approach via CLI instead
    console.log("Schema push should be done via: npx drizzle-kit push");
    console.log("Make sure DATABASE_URL is set in your environment");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }

  await pool.end();
}

pushSchema();
