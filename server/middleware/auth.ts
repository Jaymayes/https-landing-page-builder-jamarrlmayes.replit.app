import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Clerk Authentication Middleware
 *
 * Aligns with Venture Acceleration Platform standard for auth.
 * Protects dashboard routes from unauthorized access.
 */

// Get authorized admin user IDs from environment
const ADMIN_USER_IDS = (process.env.ADMIN_USER_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * Require authentication for dashboard routes
 * Uses Clerk's built-in middleware
 * Note: Type assertion via unknown due to express version mismatch in @clerk/clerk-sdk-node
 */
export const requireAuth = ClerkExpressRequireAuth({
  // Optional: Add authorized parties for extra security
  // authorizedParties: ['https://your-domain.com']
}) as unknown as RequestHandler;

/**
 * Check if the authenticated user is an admin
 * Must be used AFTER requireAuth middleware
 */
export const requireAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Type assertion for auth property added by Clerk
  const auth = (req as any).auth;
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // If no admin IDs configured, allow all authenticated users (dev mode)
  if (ADMIN_USER_IDS.length === 0) {
    console.warn("ADMIN_USER_ID not configured - allowing all authenticated users");
    next();
    return;
  }

  // Check if user is in the admin list
  if (!ADMIN_USER_IDS.includes(userId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
};

/**
 * Optional auth - allows both authenticated and unauthenticated requests
 * Useful for public endpoints that show different data to logged-in users
 */
export const optionalAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Just pass through - Clerk will attach auth if present
  next();
};

/**
 * Development bypass - skip auth in development mode
 * ONLY use this for local testing
 */
export const devBypassAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV === "development" && process.env.SKIP_AUTH === "true") {
    console.warn("Auth bypassed in development mode");
    next();
    return;
  }

  // In production, use real auth
  requireAuth(req, res, next);
};
