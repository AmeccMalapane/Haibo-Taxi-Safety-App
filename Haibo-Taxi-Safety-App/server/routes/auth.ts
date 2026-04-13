import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users, otpCodes } from "../../shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { generateToken, generateRefreshToken, verifyRefreshToken, authMiddleware, AuthRequest } from "../middleware/auth";
import { authRateLimit, sensitiveRateLimit, otpSendPhoneRateLimit } from "../middleware/rateLimit";
import { sendOtpSms } from "../services/sms";
import { generateOTP, generateReferralCode } from "../utils/helpers";

const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000;

const router = Router();

// POST /api/auth/register
router.post("/register", authRateLimit, async (req: Request, res: Response) => {
  try {
    const { phone, email, password, displayName, role, avatarType } = req.body;

    if (!phone) {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }

    // Check if user already exists
    const existing = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "User with this phone number already exists" });
      return;
    }

    // Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const referralCode = generateReferralCode();

    const [newUser] = await db.insert(users).values({
      phone,
      email: email || null,
      password: hashedPassword,
      displayName: displayName || null,
      role: role || "commuter",
      avatarType: avatarType || "commuter",
      referralCode,
    }).returning();

    const token = generateToken({
      userId: newUser.id,
      phone: newUser.phone,
      role: newUser.role || "commuter",
    });

    const refreshToken = generateRefreshToken({
      userId: newUser.id,
      phone: newUser.phone,
      role: newUser.role || "commuter",
    });

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: newUser.id,
        phone: newUser.phone,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        avatarType: newUser.avatarType,
        referralCode: newUser.referralCode,
        walletBalance: newUser.walletBalance,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", authRateLimit, async (req: Request, res: Response) => {
  try {
    const { phone, password, email } = req.body;

    if (!phone && !email) {
      res.status(400).json({ error: "Phone or email is required" });
      return;
    }

    let user;
    if (phone) {
      const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
      user = result[0];
    } else if (email) {
      const result = await db.select().from(users).where(eq(users.email!, email)).limit(1);
      user = result[0];
    }

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // If password-based login
    if (password && user.password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
    }

    // Update last active
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || "commuter",
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || "commuter",
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarType: user.avatarType,
        referralCode: user.referralCode,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/send-otp
router.post("/send-otp", authRateLimit, otpSendPhoneRateLimit, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== "string") {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }

    // Invalidate any prior unverified OTPs for this phone — only one active code at a time.
    await db.update(otpCodes)
      .set({ verified: true, attempts: MAX_OTP_ATTEMPTS })
      .where(and(eq(otpCodes.phone, phone), eq(otpCodes.verified, false)));

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await db.insert(otpCodes).values({
      phone,
      code,
      expiresAt,
      attempts: 0,
    });

    // Send OTP via Azure Communication Services SMS
    await sendOtpSms(phone, code);

    res.json({ message: "OTP sent successfully", expiresIn: OTP_TTL_MS / 1000 });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", authRateLimit, async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      res.status(400).json({ error: "Phone and code are required" });
      return;
    }

    // Look up the most recent active OTP for this phone (not yet verified, not expired, under attempt cap).
    const activeOtps = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, phone),
          eq(otpCodes.verified, false),
          gt(otpCodes.expiresAt, new Date())
        )
      )
      .limit(1);

    if (activeOtps.length === 0) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    const activeOtp = activeOtps[0];

    if ((activeOtp.attempts || 0) >= MAX_OTP_ATTEMPTS) {
      // Burn the OTP so further guesses are impossible.
      await db.update(otpCodes).set({ verified: true }).where(eq(otpCodes.id, activeOtp.id));
      res.status(429).json({ error: "Too many failed attempts. Request a new OTP." });
      return;
    }

    if (activeOtp.code !== code) {
      await db.update(otpCodes)
        .set({ attempts: sql`${otpCodes.attempts} + 1` })
        .where(eq(otpCodes.id, activeOtp.id));
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    // Mark OTP as verified
    await db.update(otpCodes).set({ verified: true }).where(eq(otpCodes.id, activeOtp.id));

    // Check if user exists, if not create
    let userResult = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    let user = userResult[0];

    if (!user) {
      const referralCode = generateReferralCode();
      const [newUser] = await db.insert(users).values({
        phone,
        isVerified: true,
        referralCode,
      }).returning();
      user = newUser;
    } else {
      await db.update(users).set({ isVerified: true, lastActiveAt: new Date() }).where(eq(users.id, user.id));
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || "commuter",
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || "commuter",
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarType: user.avatarType,
        referralCode: user.referralCode,
        walletBalance: user.walletBalance,
        isVerified: true,
      },
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "OTP verification failed" });
  }
});

// POST /api/auth/refresh — exchange a valid refresh token for a fresh access+refresh pair.
// Rate-limited per-IP to prevent stolen-refresh-token abuse.
router.post("/refresh", authRateLimit, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken || typeof refreshToken !== "string") {
      res.status(400).json({ error: "Refresh token is required" });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Re-read the user so role changes / deletions propagate on refresh.
    const result = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    const user = result[0];
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || "commuter",
    });

    const newRefreshToken = generateRefreshToken({
      userId: user.id,
      phone: user.phone,
      role: user.role || "commuter",
    });

    res.json({ token, refreshToken: newRefreshToken });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    const user = result[0];

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarType: user.avatarType,
      referralCode: user.referralCode,
      walletBalance: user.walletBalance,
      isVerified: user.isVerified,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      homeAddress: user.homeAddress,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// POST /api/auth/reset-password (no auth required — uses verified OTP)
router.post("/reset-password", sensitiveRateLimit, async (req: Request, res: Response) => {
  try {
    const { phone, code, newPassword } = req.body;

    if (!phone || !code || !newPassword) {
      res.status(400).json({ error: "Phone, OTP code, and new password are required" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }

    // Verify the OTP was recently verified (within last 10 minutes)
    const otpRecords = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, phone),
          eq(otpCodes.code, code),
          eq(otpCodes.verified, true),
          gt(otpCodes.createdAt, new Date(Date.now() - OTP_TTL_MS))
        )
      )
      .limit(1);

    if (otpRecords.length === 0) {
      res.status(400).json({ error: "Invalid or expired OTP. Please verify your OTP first." });
      return;
    }

    // Find the user
    const userResult = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    const user = userResult[0];

    if (!user) {
      res.status(404).json({ error: "No account found with this phone number" });
      return;
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));

    // Clean up used OTP
    await db.delete(otpCodes).where(eq(otpCodes.id, otpRecords[0].id));

    res.json({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// PUT /api/auth/change-password
router.put("/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current password and new password are required" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }

    // Get user from database
    const result = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    const user = result[0];

    if (!user || !user.password) {
      res.status(404).json({ error: "User not found or no password set" });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, req.user!.userId));

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// PUT /api/auth/profile
router.put("/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, email, avatarType, emergencyContactName, emergencyContactPhone, homeAddress, fcmToken } = req.body;

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (email !== undefined) updateData.email = email;
    if (avatarType !== undefined) updateData.avatarType = avatarType;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone;
    if (homeAddress !== undefined) updateData.homeAddress = homeAddress;
    if (fcmToken !== undefined) updateData.fcmToken = fcmToken;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.user!.userId)).returning();

    res.json({
      id: updated.id,
      phone: updated.phone,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      avatarType: updated.avatarType,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
