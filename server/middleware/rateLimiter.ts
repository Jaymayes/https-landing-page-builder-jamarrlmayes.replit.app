import rateLimit from "express-rate-limit";

/**
 * Rate Limiting Middleware - The "Guardrail Layer"
 *
 * Prevents:
 * 1. DDoS attacks on expensive AI endpoints (token burning/bill shock)
 * 2. Webhook spam from misconfigured integrations
 * 3. Abuse of the lead qualification system
 */

/**
 * AI Chat Endpoint Rate Limiter (Critical)
 * Prevents token burning and protects OpenAI API costs
 *
 * Config: 20 requests per hour per IP
 * This allows ~20 conversation turns per session, which is generous
 * for a qualification conversation.
 */
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour per IP
  message: {
    error: "Too many requests. Please wait before continuing the conversation.",
    retryAfter: "1 hour",
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For for proxied requests (Replit, Vercel, etc.)
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
           req.ip ||
           "unknown";
  },
});

/**
 * Webhook Rate Limiter
 * Prevents spam from misconfigured Calendly/Slack integrations
 *
 * Config: 100 requests per 15 minutes
 * Calendly typically sends 1 webhook per booking, so this is very generous.
 */
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: "Too many webhook events. Please check your integration configuration.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * HeyGen Token Endpoint Rate Limiter
 * Prevents abuse of streaming avatar sessions (expensive!)
 *
 * Config: 5 tokens per hour per IP
 * Each token = 1 avatar session. 5 is generous for legitimate use.
 */
export const heygenTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 tokens per hour per IP
  message: {
    error: "Too many avatar sessions requested. Please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
           req.ip ||
           "unknown";
  },
});

/**
 * General API Rate Limiter
 * Catch-all for other API endpoints
 *
 * Config: 100 requests per 15 minutes per IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lead Submission Rate Limiter
 * Prevents lead spam/farming
 *
 * Config: 10 leads per hour per IP
 */
export const leadSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 lead submissions per hour per IP
  message: {
    error: "Too many submissions. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
           req.ip ||
           "unknown";
  },
});
