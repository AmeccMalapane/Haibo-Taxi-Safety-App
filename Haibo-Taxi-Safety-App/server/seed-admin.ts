import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { db, pool } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Seed the Command Center admin account. Pulls credentials from env so
// production doesn't get a well-known default. If ADMIN_SEED_PASSWORD
// isn't set, a random 24-char password is generated + printed ONCE; the
// operator must copy it immediately because it's never stored in plain
// text anywhere. This replaces the previous hard-coded "admin123" which
// would otherwise be a known-good password on every fresh deploy.
async function seedAdmin() {
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_SEED_PASSWORD) {
    console.error(
      "[seed-admin] Refusing to run in production without ADMIN_SEED_PASSWORD.",
    );
    console.error(
      "Set ADMIN_SEED_PASSWORD in Azure App Service Configuration and re-run.",
    );
    process.exit(1);
  }

  const email = process.env.ADMIN_SEED_EMAIL || "admin@haibo.co.za";
  const phone = process.env.ADMIN_SEED_PHONE || "+27000000001";
  const displayName = process.env.ADMIN_SEED_NAME || "Haibo Admin";
  const envPassword = process.env.ADMIN_SEED_PASSWORD;
  const password = envPassword || crypto.randomBytes(18).toString("base64url");
  const passwordSource = envPassword ? "env (ADMIN_SEED_PASSWORD)" : "generated";

  // Check if admin already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    // Update role to admin if not already — but never silently rewrite
    // the password on reruns. If the operator needs to rotate, they
    // delete the row first. Rotating in a seed script without a flag
    // is the kind of thing that burns shift handovers.
    if (existing[0].role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing[0].id));
      console.log(`Updated ${email} role to admin`);
    } else {
      console.log(`Admin user ${email} already exists — password unchanged`);
    }
    await pool.end();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    phone,
    email,
    password: hashedPassword,
    displayName,
    role: "admin",
    isVerified: true,
    referralCode: "HB-ADMIN001",
  });

  console.log(`Created admin user: ${email}`);
  console.log("\nCommand Center login credentials:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}   (${passwordSource})`);
  if (!envPassword) {
    console.log(
      "\n⚠  This is a generated password. Copy it now — it will not be shown again.",
    );
    console.log(
      "   Set ADMIN_SEED_PASSWORD in your env if you'd prefer to control it directly.",
    );
  }

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
