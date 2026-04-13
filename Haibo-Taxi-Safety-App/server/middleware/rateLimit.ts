import { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiter (no Redis dependency needed for now).
 * Tracks request counts per IP within a sliding window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  stores.forEach((store) => {
    store.forEach((entry, key) => {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    });
  });
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  name?: string;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 min
    max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
    name = "default",
    message = "Too many requests, please try again later",
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || "unknown",
  } = options;

  const store = getStore(name);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      next();
      return;
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSecs);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.status(429).json({ error: message, retryAfter: retryAfterSecs });
      return;
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", max - entry.count);
    next();
  };
}

/**
 * Stricter rate limit for auth endpoints (login, OTP, register).
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "10", 10),
  name: "auth",
  message: "Too many authentication attempts, please try again in 15 minutes",
});

/**
 * General API rate limit.
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: "api",
});

/**
 * Strict rate limit for sensitive operations (password reset, withdrawals).
 */
export const sensitiveRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  name: "sensitive",
  message: "Too many attempts for this operation, please try again in 1 hour",
});

/**
 * Per-phone limit for OTP sends — prevents attackers from burning through OTPs
 * against a single target phone. Key is `req.body.phone`, falling back to IP.
 */
export const otpSendPhoneRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  name: "otp-send-phone",
  message: "Too many OTP requests for this phone. Please try again in 1 hour.",
  keyGenerator: (req: Request) =>
    `phone:${(req.body?.phone as string) || req.ip || "unknown"}`,
});

/**
 * Per-endpoint limit for wallet transfers — financial abuse mitigation.
 */
export const financialRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  name: "financial",
  message: "Too many financial operations. Please try again later.",
});

/**
 * Per-user limit for SOS triggers — prevents spam while keeping real emergencies
 * responsive. Keyed by authenticated user id when present, falling back to IP.
 */
export const sosRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  name: "sos",
  message: "SOS rate limit reached. If this is a real emergency, call 10111.",
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId;
    return userId ? `user:${userId}` : `ip:${req.ip || "unknown"}`;
  },
});

/**
 * Guest SOS rate limit — tighter than authenticated, keyed by IP+deviceId.
 * Guests are unauthenticated so the attack surface is wider; we need
 * stricter caps without blocking a genuine emergency burst.
 */
export const sosGuestRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 2,
  name: "sos-guest",
  message: "SOS rate limit reached. If this is a real emergency, call 10111.",
  keyGenerator: (req: Request) => {
    const deviceId = (req.body?.deviceId as string) || "";
    const ip = req.ip || "unknown";
    return deviceId ? `guest:${ip}:${deviceId}` : `guest:${ip}`;
  },
});
