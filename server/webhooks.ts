import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { webhookLimiter } from "./middleware/rateLimiter";

const CALENDLY_SIGNING_KEY = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Verify Calendly webhook signature
 * Calendly uses HMAC SHA256 with format: t=timestamp,v1=signature
 */
function verifyCalendlySignature(
  payload: string,
  signature: string | undefined,
  signingKey: string
): boolean {
  if (!signature) return false;

  // Parse signature header: t=timestamp,v1=signature
  const parts = signature.split(",").reduce(
    (acc, curr) => {
      const [key, val] = curr.split("=");
      if (key === "t") acc.t = val;
      if (key === "v1") acc.v1 = val;
      return acc;
    },
    { t: "", v1: "" }
  );

  if (!parts.t || !parts.v1) return false;

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac("sha256", signingKey)
    .update(parts.t + "." + payload)
    .digest("hex");

  return parts.v1 === expectedSignature;
}

/**
 * Send Slack notification for booked meeting
 */
async function sendBookedSlackNotification(lead: {
  name: string;
  company: string;
  email: string;
  painPoint: string;
}, scheduledTime: string): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log("Slack webhook not configured, skipping BOOKED notification");
    return;
  }

  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "✅ MEETING BOOKED",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Lead:*\n${lead.name}`,
          },
          {
            type: "mrkdwn",
            text: `*Company:*\n${lead.company}`,
          },
          {
            type: "mrkdwn",
            text: `*Email:*\n${lead.email}`,
          },
          {
            type: "mrkdwn",
            text: `*Pain Point:*\n${lead.painPoint}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Scheduled Time:*\n${new Date(scheduledTime).toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "🎯 Loop closed. Lead converted to scheduled call.",
          },
        ],
      },
    ],
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    console.log("BOOKED Slack notification sent successfully");
  } catch (error) {
    console.error("Failed to send BOOKED Slack notification:", error);
  }
}

/**
 * Register webhook routes
 * IMPORTANT: These routes need raw body access for signature verification
 */
export function registerWebhookRoutes(app: Express): void {
  /**
   * Calendly Webhook Handler
   * Event: invitee.created (when someone books a meeting)
   *
   * This "closes the loop" by:
   * 1. Verifying the webhook signature
   * 2. Finding the matching lead by email (Option B)
   * 3. Updating the lead with scheduledCall = true
   * 4. Sending a BOOKED notification to Slack
   */
  app.post("/api/webhooks/calendly", webhookLimiter, async (req: Request, res: Response) => {
    try {
      // 1. Check for signing key configuration
      if (!CALENDLY_SIGNING_KEY) {
        console.warn("CALENDLY_WEBHOOK_SIGNING_KEY not configured - skipping signature verification");
        // In production, you should require the signing key
        // return res.status(500).json({ error: "Webhook signing key not configured" });
      }

      const signature = req.headers["calendly-webhook-signature"] as string | undefined;

      // 2. Verify signature (if signing key is configured)
      if (CALENDLY_SIGNING_KEY) {
        // req.body should be the raw string when using express.raw() middleware
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

        if (!verifyCalendlySignature(rawBody, signature, CALENDLY_SIGNING_KEY)) {
          console.error("Invalid Calendly webhook signature");
          return res.status(403).json({ error: "Invalid signature" });
        }
      }

      // 3. Parse the payload
      const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      console.log("Calendly webhook received:", event.event);

      // 4. Handle invitee.created event
      if (event.event === "invitee.created") {
        const payload = event.payload;
        const email = payload.email?.toLowerCase();
        const eventUri = payload.event;
        const inviteeUri = payload.uri;
        const scheduledTime = payload.scheduled_event?.start_time;

        if (!email) {
          console.error("No email in Calendly webhook payload");
          return res.status(400).json({ error: "Missing email in payload" });
        }

        // 5. IDEMPOTENCY CHECK - Prevent duplicate processing on webhook retries
        // Calendly sends retries if server blinks; we must check if already processed
        const existingBooking = await storage.getLeadByCalendlyUri(inviteeUri);
        if (existingBooking) {
          console.log(`♻️ Idempotency: Event ${inviteeUri} already processed for lead ${existingBooking.id}`);
          return res.status(200).json({ received: true, message: "Event already processed" });
        }

        // 6. Option B: Find most recent unscheduled lead by email
        const matchingLead = await storage.getUnscheduledLeadByEmail(email);

        if (matchingLead) {
          // 6. Update the lead - "Close the Loop"
          // Check if this is a high-intent lead (eligible for Success Fee)
          const isHighIntent = matchingLead.isHighIntent || false;

          const updatedLead = await storage.markLeadAsScheduled(
            matchingLead.id,
            {
              calendlyEventUri: eventUri,
              calendlyInviteeUri: inviteeUri,
              scheduledAt: new Date(scheduledTime),
            },
            isHighIntent
          );

          console.log(`Lead ${matchingLead.id} marked as scheduled (High Intent: ${isHighIntent}):`, updatedLead);

          // 7. Send BOOKED Slack notification
          await sendBookedSlackNotification(
            {
              name: matchingLead.name,
              company: matchingLead.company,
              email: matchingLead.email,
              painPoint: matchingLead.painPoint,
            },
            scheduledTime
          );
        } else {
          // Lead not found - this is a "cold" booking (someone found Calendly directly)
          console.log(`Booking received for ${email} but no matching unscheduled lead found`);

          // Optionally: Create a new lead record for cold bookings
          // await storage.createLead({ email, painPoint: "Direct Calendly booking", ... });
        }
      }

      // 8. Acknowledge the webhook
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error processing Calendly webhook:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  /**
   * Webhook health check endpoint
   * Use this to verify your webhook URL is accessible
   */
  app.get("/api/webhooks/calendly", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      message: "Calendly webhook endpoint is active",
      configured: !!CALENDLY_SIGNING_KEY,
    });
  });
}
