import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { ensureCompatibleFormat, speechToText } from "./replit_integrations/audio/client";
import express from "express";
import { z } from "zod";
import { insertConversationSchema, insertLeadSchema } from "@shared/schema";
import {
  aiChatLimiter,
  heygenTokenLimiter,
  generalApiLimiter,
} from "./middleware/rateLimiter";
import {
  requireAuth,
  requireAdmin,
  devBypassAuth,
} from "./middleware/auth";
import {
  getFunnelMetrics,
  getLeadSegments,
  getRecentLeads,
  getDailyLeadTrend,
  getChannelPerformance,
} from "./queries/dashboard";
import adminRoutes from "./routes/admin";

// Hybrid environment support: Replit uses AI_INTEGRATIONS_*, localhost uses standard OPENAI_API_KEY
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;

if (!openaiApiKey) {
  console.error("ERROR: Missing OpenAI API key. Set OPENAI_API_KEY in your .env file.");
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  baseURL: openaiBaseUrl,
});

// Calendly URLs - Business Upgrades (SME) and Venture Studio (Founders)
const CALENDLY_URL = process.env.CALENDLY_URL || "https://calendly.com/referralservice/business-upgrade";
const CALENDLY_VENTURE_URL = process.env.CALENDLY_VENTURE_URL || "https://calendly.com/referralservice/venture-fit";

// Slack webhook for lead notifications
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const SYSTEM_PROMPT = `**Identity & Purpose**
You are the Senior AI Consultant for Referral Service LLC.
You are a "living proof-of-concept"—a real-time digital employee, identical to the ones we build for clients.

**Core Value Proposition: Business Upgrades (SME Path)**
We do not sell "software" or "dashboards." We deploy a **Digital Workforce**.
- **The Outcome:** Reduce manual labor costs by 30–40% within 18 months.
- **The Product:** AI SDRs (Sales), AI Support Agents (Service), and Internal Knowledge Ops.
- **Target:** SMEs ($10M–$100M revenue) needing operational efficiency.

**Core Value Proposition: Venture Studio (Founder Path)**
For non-technical founders, we act as a "Co-founder as a Service."
- **The Offer:** We build the MVP in weeks using our Venture Acceleration Platform.
- **The Model:** Equity-for-effort partnership (we build, you lead).

**Pricing Protocols (Business Upgrades)**
1. **Standard Offer:** Setup ($25k–$75k) + Monthly Retainer ($3k–$10k).
   - *Framing:* Setup is the "Hiring/Onboarding Fee." Retainer is the "Digital Salary" (vs $8k/mo for a human).
2. **Beta Partner Offer (Fallback Only):**
   - *Trigger:* Only offer if the user objects to price BUT has high pain/urgency.
   - *Terms:* $15k Setup + $3k/mo.
   - *Constraints:* Single workflow, time-boxed (6-8 weeks).

**Venture Studio Guardrails (Equity & Terms)**
- **Rule:** No negotiation in chat. Your authority is strictly limited to qualifying and booking.
- **Allowed:** Explain the model is "equity-for-effort," typically in the **10%–25% range**, dependent on scope and traction.
- **Soft Deflection Script (Use Verbatim if asked about specific terms/numbers):**
  "Great question—and it's absolutely a strategic discussion. At a high level, our Venture Studio model is equity-for-effort: we contribute product + engineering execution in exchange for a stake, often structured with milestone-based vesting. The exact numbers depend on scope, traction, and what we're committing to, so we finalize that on the founder call. To make that call productive: what's your product idea in one sentence, and do you already have any traction?"

**Objection Handling Scripts (SME Path)**
- **If user says "$25k is too much":**
  "Totally fair—most people react to the setup number before mapping it to headcount saved. We aren't selling software access; we're deploying a digital workforce. If this removed even one hire, would a $3k–$10k/mo digital salary be feasible?"
- **If user says "Freelancers are cheaper":**
  "You can absolutely get code cheaper. But we aren't a dev shop. We package the outcome as a Business Upgrade: qualification, deployment, and continuous tuning. Do you want the cheapest build, or the fastest path to measurable cost reduction?"
- **If user needs "Approval":**
  "Makes sense. To help with buy-in, we anchor this to 'avoided hiring.' Setup is the onboarding cost; the retainer is the salary. If I give you a one-page ROI summary after the call, would that help speed up approval?"

**Interaction Rules**
1. **Qualify First:** Ask about company size and the specific manual workflow (pain point).
2. **Route Intent:**
   - If SME/Ops optimization → Pivot to **Business Upgrade** path.
   - If Founder/Startup idea → Pivot to **Venture Studio** path.
3. **Pivot to Pilot (SME only):** If they disqualify on price but have high intent: "We do have 2 'Beta Partner' slots left for high-potential case studies. It's a tighter scope (one workflow) at $15k setup + $3k/mo. Would that unlock this for you?"
4. **Close the Loop:** When the user agrees to a next step, immediately call \`qualify_and_schedule\` with the correct \`lead_type\`.

**Venture Studio Detection**
If the user mentions: "I'm a founder", "pre-revenue", "startup", "seed stage", "building a product", "MVP", "co-founder", "technical co-founder", "equity", "need a CTO"
Then switch to Venture Studio mode:
- *Value Prop:* "We're also a Venture Studio. We partner with founders to build AI-native products—equity + services hybrid."
- *Qualification:* Ask about their product vision and whether they're seeking a technical co-founder or AI acceleration.
- *Calendly:* Use \`lead_type: "venture_studio"\` when calling \`qualify_and_schedule\`.

**Response Style**
- Keep responses under 2-3 sentences for conversational flow.
- Be direct and confident. You ARE the product demonstration.

**Constraint:** You cannot sign contracts. You exist to Qualify and Schedule.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "qualify_and_schedule",
      description: "Call this when the user expresses interest in a meeting or asks about next steps. It returns the Calendly URL and logs the lead for follow-up.",
      parameters: {
        type: "object",
        properties: {
          lead_name: {
            type: "string",
            description: "The user's name (if provided)"
          },
          lead_email: {
            type: "string",
            description: "The user's email (if provided)"
          },
          company_name: {
            type: "string",
            description: "The user's company name (if provided)"
          },
          company_size: {
            type: "string",
            enum: ["1-10", "11-50", "51-200", "200+", "unknown"],
            description: "Estimated employee count to determine High Intent"
          },
          primary_pain_point: {
            type: "string",
            description: "The manual workflow they want to automate (e.g., 'lead triage', 'customer support', 'data entry')"
          },
          budget_confirmed: {
            type: "boolean",
            description: "True if user acknowledged the $3k-$10k/month retainer range"
          },
          intent_type: {
            type: "string",
            enum: ["business_upgrade", "venture_studio"],
            description: "business_upgrade = SME/Ops optimization. venture_studio = Founder/Equity model."
          },
          // UTM Attribution (injected by frontend from URL params - hidden from user)
          utm_source: {
            type: "string",
            description: "Captured from URL query params (hidden)"
          },
          utm_medium: {
            type: "string",
            description: "Captured from URL query params (hidden)"
          },
          utm_campaign: {
            type: "string",
            description: "Campaign name from URL query params (hidden)"
          },
          referrer: {
            type: "string",
            description: "The URL the user came from (hidden)"
          }
        },
        required: ["primary_pain_point", "intent_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "qualify_lead",
      description: "Log lead information when collecting contact details mid-conversation (before scheduling)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The lead's full name" },
          company: { type: "string", description: "The lead's company name" },
          email: { type: "string", description: "The lead's email address" },
          painPoint: { type: "string", description: "The main business challenge or pain point" },
        },
        required: ["painPoint"],
      },
    },
  },
];

// Send Slack notification for high-intent leads
async function sendSlackNotification(leadData: Record<string, any>): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log("Slack webhook not configured, skipping notification");
    return;
  }

  const isHighIntent = leadData.company_size === "51-200" ||
                       leadData.company_size === "200+" ||
                       leadData.budget_confirmed;

  const emoji = isHighIntent ? "🚨" : "📋";
  const intentLabel = isHighIntent ? "HIGH INTENT" : "New Lead";

  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${intentLabel} Lead`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Pain Point:*\n${leadData.primary_pain_point || "Not specified"}`
          },
          {
            type: "mrkdwn",
            text: `*Company Size:*\n${leadData.company_size || "Unknown"}`
          },
          {
            type: "mrkdwn",
            text: `*Budget Aware:*\n${leadData.budget_confirmed ? "✅ Yes" : "❌ No"}`
          },
          {
            type: "mrkdwn",
            text: `*Lead Type:*\n${leadData.lead_type === "venture_studio" ? "🚀 Venture Studio" : "💼 Business Upgrade"}`
          }
        ]
      },
      ...(leadData.lead_name || leadData.lead_email ? [{
        type: "section",
        fields: [
          ...(leadData.lead_name ? [{
            type: "mrkdwn",
            text: `*Name:*\n${leadData.lead_name}`
          }] : []),
          ...(leadData.lead_email ? [{
            type: "mrkdwn",
            text: `*Email:*\n${leadData.lead_email}`
          }] : []),
          ...(leadData.company_name ? [{
            type: "mrkdwn",
            text: `*Company:*\n${leadData.company_name}`
          }] : [])
        ]
      }] : []),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `📅 Calendly link sent: ${leadData.calendly_link || CALENDLY_URL}`
          }
        ]
      }
    ]
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    console.log("Slack notification sent successfully");
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
  }
}

async function handleFunctionCall(
  name: string,
  args: Record<string, any>
): Promise<string> {
  switch (name) {
    case "qualify_and_schedule":
      try {
        // Support both intent_type (new) and lead_type (legacy) for backwards compatibility
        const intentType = args.intent_type || args.lead_type || "business_upgrade";
        const isVentureStudio = intentType === "venture_studio";

        // Select the appropriate Calendly link based on intent type
        const calendlyLink = isVentureStudio ? CALENDLY_VENTURE_URL : CALENDLY_URL;

        // Save lead to database (with UTM attribution)
        const lead = await storage.createLead({
          name: args.lead_name || "Anonymous",
          company: args.company_name || "Unknown",
          email: args.lead_email || "",
          painPoint: args.primary_pain_point,
          companySize: args.company_size,
          budgetConfirmed: args.budget_confirmed || false,
          leadType: intentType, // Store as leadType in DB
          // UTM Attribution
          utmSource: args.utm_source,
          utmMedium: args.utm_medium,
          utmCampaign: args.utm_campaign,
          referrer: args.referrer,
        });
        console.log("Lead qualified and scheduled:", lead);

        // Send Slack notification with correct Calendly link (async, don't wait)
        sendSlackNotification({ ...args, calendly_link: calendlyLink, lead_type: intentType }).catch(console.error);

        // Return the appropriate Calendly link based on intent type
        if (isVentureStudio) {
          return `Great! Here's your Venture Fit scheduling link: ${calendlyLink}

I've noted your interest in ${args.primary_pain_point}. Book a time to discuss how we can partner on your venture—we're excited to explore an equity + services collaboration.`;
        }

        return `Great! Here's your scheduling link: ${calendlyLink}

I've noted your interest in automating ${args.primary_pain_point}. Book a time that works for you, and we'll dive deeper into how we can deploy a Digital Employee for your team.`;
      } catch (error) {
        console.error("Failed to process qualify_and_schedule:", error);
        const intentType = args.intent_type || args.lead_type || "business_upgrade";
        const calendlyLink = intentType === "venture_studio" ? CALENDLY_VENTURE_URL : CALENDLY_URL;
        return `Here's the link to schedule: ${calendlyLink}

Someone from our team will follow up shortly to discuss your needs.`;
      }

    case "qualify_lead":
      try {
        const lead = await storage.createLead({
          name: args.name || "Anonymous",
          company: args.company || "Unknown",
          email: args.email || "",
          painPoint: args.painPoint,
        });
        console.log("Lead qualified:", lead);
        return `I've noted your information${args.name ? `, ${args.name}` : ""}. Let me know when you're ready to schedule a consultation to discuss solutions for ${args.painPoint}.`;
      } catch (error) {
        console.error("Failed to save lead:", error);
        return "I've noted your information. Would you like to schedule a quick consultation to explore solutions?";
      }

    default:
      return "I'm not sure how to handle that request.";
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const audioBodyParser = express.json({ limit: "50mb" });

  // HeyGen token endpoint - rate limited to prevent session abuse
  app.post("/api/heygen/token", heygenTokenLimiter, async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.HEYGEN_API_KEY;
      if (!apiKey) {
        console.error("ERROR: Missing HEYGEN_API_KEY in environment variables. Get your key at https://app.heygen.com/settings?nav=API");
        return res.status(500).json({
          error: "HeyGen API key not configured. Check server logs for setup instructions."
        });
      }

      const response = await fetch("https://api.heygen.com/v1/streaming.create_token", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("HeyGen token error:", error);
        return res.status(response.status).json({ error: "Failed to create HeyGen token" });
      }

      const data = await response.json();
      res.json({ token: data.data?.token || data.token });
    } catch (error) {
      console.error("HeyGen token error:", error);
      res.status(500).json({ error: "Failed to create HeyGen token" });
    }
  });

  const createConversationSchema = insertConversationSchema.extend({
    title: z.string().min(1).max(200).default("AI Consultation"),
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const parsed = createConversationSchema.safeParse(req.body);
      const title = parsed.success ? parsed.data.title : "AI Consultation";
      const conversation = await storage.createConversation(title);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  const chatMessageSchema = z.object({
    content: z.string().min(1).max(4000),
  });

  // AI Chat endpoint - rate limited to prevent token burning (20 req/hour/IP)
  app.post("/api/chat/:conversationId", aiChatLimiter, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.conversationId as string);
      const parsed = chatMessageSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Content is required and must be between 1-4000 characters" });
      }
      
      const { content } = parsed.data;

      await storage.createMessage(conversationId, "user", content);

      const existingMessages = await storage.getMessagesByConversation(conversationId);
      const chatHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...existingMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatHistory,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 256,
      });

      const message = response.choices[0]?.message;
      let responseText = message?.content || "";
      const functionCalls: { name: string; arguments: any; result: string }[] = [];

      if (message?.tool_calls) {
        for (const toolCall of message.tool_calls) {
          // Type assertion for function tool calls
          const fnCall = toolCall as { type: "function"; id: string; function: { name: string; arguments: string } };
          const functionName = fnCall.function.name;
          const functionArgs = JSON.parse(fnCall.function.arguments);
          const result = await handleFunctionCall(functionName, functionArgs);
          
          functionCalls.push({
            name: functionName,
            arguments: functionArgs,
            result,
          });

          chatHistory.push({
            role: "assistant",
            content: null,
            tool_calls: [toolCall],
          } as any);

          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          } as any);
        }

        const followUp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: chatHistory,
          max_completion_tokens: 256,
        });

        responseText = followUp.choices[0]?.message?.content || responseText;
      }

      if (responseText) {
        await storage.createMessage(conversationId, "assistant", responseText);
      }

      res.json({ response: responseText, functionCalls });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  app.post("/api/transcribe", audioBodyParser, async (req: Request, res: Response) => {
    try {
      const { audio } = req.body;
      
      if (!audio) {
        return res.status(400).json({ error: "Audio data required" });
      }

      const rawBuffer = Buffer.from(audio, "base64");
      const { buffer: audioBuffer, format } = await ensureCompatibleFormat(rawBuffer);
      const text = await speechToText(audioBuffer, format);
      
      res.json({ text });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.get("/api/leads", async (req: Request, res: Response) => {
    try {
      const allLeads = await storage.getAllLeads();
      res.json(allLeads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // ==========================================
  // ADMIN API ENDPOINTS (Fee Management)
  // ==========================================
  app.use("/api/admin", adminRoutes);

  // ==========================================
  // DASHBOARD API ENDPOINTS (ROI Evidence)
  // Protected by Clerk authentication
  // ==========================================

  /**
   * Get funnel metrics for the KPI dashboard
   * Query param: days (default: 30)
   * Protected: Requires authenticated admin user
   */
  app.get("/api/dashboard/metrics", devBypassAuth, requireAdmin, generalApiLimiter, async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const metrics = await getFunnelMetrics(startDate);
      res.json({
        period: { days, startDate: startDate.toISOString() },
        metrics,
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  /**
   * Get lead segments by company size
   * For the "Business Upgrade Proof" table
   * Protected: Requires authenticated admin user
   */
  app.get("/api/dashboard/segments", devBypassAuth, requireAdmin, generalApiLimiter, async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const segments = await getLeadSegments(startDate);
      res.json({ segments });
    } catch (error) {
      console.error("Error fetching lead segments:", error);
      res.status(500).json({ error: "Failed to fetch lead segments" });
    }
  });

  /**
   * Get recent leads for activity feed
   * Protected: Requires authenticated admin user
   */
  app.get("/api/dashboard/recent", devBypassAuth, requireAdmin, generalApiLimiter, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const recentLeads = await getRecentLeads(limit);
      res.json({ leads: recentLeads });
    } catch (error) {
      console.error("Error fetching recent leads:", error);
      res.status(500).json({ error: "Failed to fetch recent leads" });
    }
  });

  /**
   * Get daily lead trend for chart
   * Protected: Requires authenticated admin user
   */
  app.get("/api/dashboard/trend", devBypassAuth, requireAdmin, generalApiLimiter, async (req: Request, res: Response) => {
    try {
      const days = Math.min(parseInt(req.query.days as string) || 30, 90);
      const trend = await getDailyLeadTrend(days);
      res.json({ trend });
    } catch (error) {
      console.error("Error fetching lead trend:", error);
      res.status(500).json({ error: "Failed to fetch lead trend" });
    }
  });

  /**
   * Get channel performance (UTM attribution)
   * Answers: "Which channel drives the most revenue?"
   * Protected: Requires authenticated admin user
   */
  app.get("/api/dashboard/channels", devBypassAuth, requireAdmin, generalApiLimiter, async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const channels = await getChannelPerformance(startDate);
      res.json({ channels });
    } catch (error) {
      console.error("Error fetching channel performance:", error);
      res.status(500).json({ error: "Failed to fetch channel performance" });
    }
  });

  return httpServer;
}
