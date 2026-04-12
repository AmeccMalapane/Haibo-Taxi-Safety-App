import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as schema from "../../shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "haibo-secret-key-change-in-production";

export function authRoutes(db: any) {
  const router = Router();

  // Register user
  router.post("/register", async (req, res) => {
    try {
      const { phone, displayName, role, password } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Check if user already exists
      const existing = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "User already exists" });
      }

      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      const [user] = await db.insert(schema.users).values({
        phone,
        displayName: displayName || null,
        role: role || "commuter",
        password: hashedPassword,
      }).returning();

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });

      res.status(201).json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed", message: error.message });
    }
  });

  // Login
  router.post("/login", async (req, res) => {
    try {
      const { phone, password } = req.body;

      const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.password && password) {
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      // Update last active
      await db.update(schema.users).set({ lastActiveAt: new Date() }).where(eq(schema.users.id, user.id));

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });

      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed", message: error.message });
    }
  });

  // Send OTP
  router.post("/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await db.insert(schema.otpCodes).values({ phone, code, expiresAt });

      // In production, send SMS via Twilio/Africa's Talking
      console.log(`OTP for ${phone}: ${code}`);

      res.json({ message: "OTP sent successfully", expiresAt });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send OTP", message: error.message });
    }
  });

  // Verify OTP
  router.post("/verify-otp", async (req, res) => {
    try {
      const { phone, code } = req.body;

      const [otp] = await db.select().from(schema.otpCodes)
        .where(eq(schema.otpCodes.phone, phone))
        .orderBy(schema.otpCodes.createdAt)
        .limit(1);

      if (!otp || otp.code !== code) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      if (new Date() > otp.expiresAt) {
        return res.status(400).json({ error: "OTP expired" });
      }

      // Mark OTP as verified
      await db.update(schema.otpCodes).set({ verified: true }).where(eq(schema.otpCodes.id, otp.id));

      // Check if user exists, if not create
      let [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
      if (!user) {
        [user] = await db.insert(schema.users).values({ phone, isVerified: true }).returning();
      } else {
        await db.update(schema.users).set({ isVerified: true }).where(eq(schema.users.id, user.id));
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });

      res.json({ user: { ...user, password: undefined }, token, verified: true });
    } catch (error: any) {
      res.status(500).json({ error: "OTP verification failed", message: error.message });
    }
  });

  return router;
}
