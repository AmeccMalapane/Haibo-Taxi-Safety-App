import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users, otpCodes } from "../../shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { generateToken, generateRefreshToken, verifyRefreshToken, authMiddleware, AuthRequest } from "../middleware/auth";
import { authRateLimit, sensitiveRateLimit, otpSendPhoneRateLimit } from "../middleware/rateLimit";
import { sendOtpSms } from "../services/sms";
import { notifyUser } from "../services/notifications";
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

    // Fire-and-forget welcome. Caught separately because a notify
    // failure must never block the register response — we've already
    // committed the user row and the client is waiting on a token.
    try {
      await notifyUser({
        userId: newUser.id,
        type: "system",
        title: "Welcome to Haibo",
        body: "You're all set. Head to the Hub to find rides, pay vendors, and keep your journeys safe.",
        data: { kind: "welcome_commuter" },
      });
    } catch (notifyErr) {
      console.log("[Auth] welcome notify failed:", notifyErr);
    }

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
    if (!password || typeof password !== "string") {
      // /login is the password path — OTP-first commuters must use
      // /send-otp + /verify-otp instead. Reject unconditionally when no
      // password is supplied. Without this, the previous `if (password
      // && user.password)` gate would skip validation entirely and hand
      // out a token for any phone/email in the system: total auth bypass.
      res.status(400).json({ error: "Password is required for this login path" });
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

    if (!user || !user.password) {
      // Use a single "invalid credentials" response for both missing
      // users and password-less accounts so attackers can't tell which
      // phones/emails are registered. Password-less users exist (OTP
      // commuters) — they must route through /verify-otp.
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ error: "Account suspended" });
      return;
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
        avatarUrl: user.avatarUrl,
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

    // Send OTP via Azure Communication Services SMS. If delivery fails
    // we must tell the client — silently claiming success would leave
    // the user waiting for a code that never arrives.
    const smsResult = await sendOtpSms(phone, code);
    if (!smsResult.success) {
      res.status(502).json({
        error:
          "We couldn't deliver the verification SMS. Please check your number or try again in a moment.",
      });
      return;
    }

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
    let isNewUser = false;

    if (!user) {
      const referralCode = generateReferralCode();
      const [newUser] = await db.insert(users).values({
        phone,
        isVerified: true,
        referralCode,
      }).returning();
      user = newUser;
      isNewUser = true;
    } else {
      if (user.isSuspended) {
        // Suspended users must not be able to re-auth via OTP — HTTP
        // authMiddleware would 403 them on every request anyway, but
        // blocking the token issuance here keeps the log trail clean
        // and saves the JWT signing work. POPIA-erased users land here
        // too (isSuspended flipped, phone anonymized) — but their phone
        // no longer matches the original so this branch is unreachable
        // for them; they'd hit the "create new user" path instead and
        // get a fresh clean-slate account, which is the intended flow.
        res.status(403).json({ error: "Account suspended" });
        return;
      }
      await db.update(users).set({ isVerified: true, lastActiveAt: new Date() }).where(eq(users.id, user.id));
    }

    // Welcome notification fires ONLY on the branch that just inserted
    // the user row — existing users re-verifying via OTP (e.g. after
    // clearing the app) must not receive a fresh "welcome" ping.
    if (isNewUser) {
      try {
        await notifyUser({
          userId: user.id,
          type: "system",
          title: "Welcome to Haibo",
          body: "You're all set. Head to the Hub to find rides, pay vendors, and keep your journeys safe.",
          data: { kind: "welcome_commuter" },
        });
      } catch (notifyErr) {
        console.log("[Auth] welcome notify failed:", notifyErr);
      }
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
        avatarUrl: user.avatarUrl,
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
    if (user.isSuspended) {
      // A suspended user holding a still-valid refresh token should not
      // be able to keep rolling it forward. Return 401 so the client
      // treats this as a logout-and-re-auth flow; HTTP authMiddleware
      // would 403 them per-request anyway, but issuing fresh tokens on
      // refresh clutters logs and leaks "this account exists" info.
      res.status(401).json({ error: "Account suspended" });
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
      handle: user.handle,
      displayName: user.displayName,
      role: user.role,
      avatarType: user.avatarType,
      avatarUrl: user.avatarUrl,
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

// Handle = public author label shown on reels/comments/ratings. Must be
// unique, lowercase, 3–20 chars, alphanumeric + underscore. Collision
// returns 409 so the client can prompt for a different one.
const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;

// POST /api/auth/handle — set or change the current user's public handle.
router.post("/handle", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const raw = typeof req.body?.handle === "string" ? req.body.handle.trim().toLowerCase() : "";
    if (!HANDLE_REGEX.test(raw)) {
      res.status(400).json({
        error: "Handle must be 3–20 characters, lowercase letters/numbers/underscore only",
        code: "INVALID_HANDLE",
      });
      return;
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, raw))
      .limit(1);
    if (existing && existing.id !== req.user!.userId) {
      res.status(409).json({ error: "Handle already taken", code: "HANDLE_TAKEN" });
      return;
    }

    await db.update(users).set({ handle: raw }).where(eq(users.id, req.user!.userId));
    res.json({ handle: raw });
  } catch (error: any) {
    console.error("Set handle error:", error);
    res.status(500).json({ error: "Failed to set handle" });
  }
});

// GET /api/auth/handle/available?h=someone — let the client check
// availability while the user types, before they tap Save.
router.get("/handle/available", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const raw = typeof req.query.h === "string" ? req.query.h.trim().toLowerCase() : "";
    if (!HANDLE_REGEX.test(raw)) {
      res.json({ available: false, reason: "invalid_format" });
      return;
    }
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, raw))
      .limit(1);
    const available = !existing || existing.id === req.user!.userId;
    res.json({ available });
  } catch (error: any) {
    console.error("Check handle error:", error);
    res.status(500).json({ error: "Failed to check handle" });
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
    const { displayName, email, avatarType, avatarUrl, emergencyContactName, emergencyContactPhone, homeAddress, fcmToken } = req.body;

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (email !== undefined) updateData.email = email;
    if (avatarType !== undefined) updateData.avatarType = avatarType;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
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
      avatarUrl: updated.avatarUrl,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/auth/users/search?q=handle_prefix — public handle search.
// Returns up to 10 matching users (id, handle, displayName, avatarUrl).
// No phone, no email — safe for @mention autocomplete without PII exposure.
router.get("/users/search", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (!q || q.length < 2) {
      res.json({ data: [] });
      return;
    }

    const rows = await db
      .select({
        id: users.id,
        handle: users.handle,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(sql`${users.handle} LIKE ${q + "%"}`)
      .limit(10);

    res.json({ data: rows });
  } catch (error: any) {
    console.error("User search error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

export default router;
