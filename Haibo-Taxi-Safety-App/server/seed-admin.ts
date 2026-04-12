import dotenv from "dotenv";
dotenv.config();

import { db, pool } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const email = "admin@haibo.co.za";
  const phone = "+27000000001";
  const password = "admin123";
  const displayName = "Amecc Malapane";

  // Check if admin already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    // Update role to admin if not already
    if (existing[0].role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing[0].id));
      console.log(`Updated ${email} role to admin`);
    } else {
      console.log(`Admin user ${email} already exists`);
    }
  } else {
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

    console.log(`Created admin user: ${email} / ${password}`);
  }

  console.log("\nCommand Center login credentials:");
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
