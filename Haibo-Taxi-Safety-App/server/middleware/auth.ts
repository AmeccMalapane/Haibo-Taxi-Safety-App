import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// --- JWT Configuration ---
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  console.error("Copy .env.example to .env and set a secure random string.");
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

const FALLBACK_SECRET = "haibo-dev-only-do-not-use-in-production";
const getSecret = () => JWT_SECRET || FALLBACK_SECRET;
const getRefreshSecret = () => JWT_REFRESH_SECRET || FALLBACK_SECRET;

export interface AuthPayload {
  userId: string;
  phone: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
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
 * Require authentication — rejects with 401 if no valid token.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
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
