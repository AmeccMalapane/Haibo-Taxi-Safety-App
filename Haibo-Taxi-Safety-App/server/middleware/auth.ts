import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  console.error("Copy .env.example to .env and set a secure random string.");
  process.exit(1);
}

const getSecret = (): string => JWT_SECRET as string;
const getRefreshSecret = (): string => (JWT_REFRESH_SECRET as string) || (JWT_SECRET as string);

export interface AuthPayload {
  userId: string;
  phone: string;
  role: string;
}

// Extra fields the middleware attaches AFTER verifying the JWT, pulled fresh
// from the users row on every request. Not part of the signed JWT so we can
// roll out new user-profile columns (like `handle`) without invalidating
// existing tokens. Handlers should prefer `handle` → `displayName` → "user"
// for any author label they persist — NEVER `phone`.
export interface AuthContext extends AuthPayload {
  handle?: string | null;
  displayName?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthContext;
}

/**
 * Derive the public author label for persisted content (reels, comments,
 * ratings, etc.). Never returns the user's phone — that's a POPIA leak.
 */
export function publicUserLabel(user: AuthContext | undefined): string {
  return user?.handle || user?.displayName || "user";
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function generateRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: "90d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getSecret()) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, getRefreshSecret()) as AuthPayload;
}

/**
 * Require authentication — rejects with 401 if no valid token, 403 if the
 * account is suspended. Async because we do one small PK lookup per call
 * to catch suspended accounts whose token is still unexpired.
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  let decoded: AuthPayload;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let enriched: AuthContext = decoded;
  try {
    const [row] = await db
      .select({
        isSuspended: users.isSuspended,
        handle: users.handle,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (row?.isSuspended) {
      res.status(403).json({
        error: "Account suspended",
        code: "ACCOUNT_SUSPENDED",
      });
      return;
    }

    enriched = {
      ...decoded,
      handle: row?.handle ?? null,
      displayName: row?.displayName ?? null,
    };
  } catch (err) {
    // If the lookup fails (DB hiccup), fail-open with just the JWT
    // payload — a DB outage shouldn't take down the whole auth layer.
    // Handlers that persist author labels fall back via publicUserLabel()
    // so they still get a safe "user" rather than leaking phone.
    console.error("[Auth] user enrichment failed:", err);
  }

  req.user = enriched;
  next();
}

/**
 * Optional auth — attaches user if token present, continues either way.
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch {
      // Token invalid, continue without auth
    }
  }

  next();
}

/**
 * Require specific role(s) — must be used after authMiddleware.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
