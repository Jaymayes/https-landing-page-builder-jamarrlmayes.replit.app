import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { ensureCompatibleFormat, speechToText } from "./replit_integrations/audio/client";
import express from "express";
import { z } from "zod";
import { insertConversationSchema, insertLeadSchema } from "@shared/schema";

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

const SYSTEM_PROMPT = `You are a senior AI consultant for Referral Service LLC. Your goal is to qualify the lead by asking about company size, pain points, and budget. Keep responses under 2 sentences. Do not promise specific deliverables without a consultation.

You have access to the following functions:
- qualify_lead: Use when user provides their contact details (name, company, email, pain point)
- check_availability: Use when user asks about scheduling or booking a consultation

Be conversational and helpful. Ask qualifying questions naturally.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "qualify_lead",
      description: "Log lead information when a user provides their contact details and pain points",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The lead's full name" },
          company: { type: "string", description: "The lead's company name" },
          email: { type: "string", description: "The lead's email address" },
          painPoint: { type: "string", description: "The main business challenge or pain point" },
        },
        required: ["name", "company", "email", "painPoint"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check available consultation slots when user wants to book a meeting",
      parameters: {
        type: "object",
        properties: {
          preferredDay: { type: "string", description: "User's preferred day for meeting" },
        },
      },
    },
  },
];

async function handleFunctionCall(
  name: string,
  args: Record<string, any>
): Promise<string> {
  switch (name) {
    case "qualify_lead":
      try {
        const lead = await storage.createLead({
          name: args.name,
          company: args.company,
          email: args.email,
          painPoint: args.painPoint,
        });
        console.log("Lead qualified:", lead);
        return `Lead has been logged: ${args.name} from ${args.company}. Thank you for your interest!`;
      } catch (error) {
        console.error("Failed to save lead:", error);
        return "I've noted your information. Someone from our team will follow up shortly.";
      }

    case "check_availability":
      return "I have slots available Tuesday at 2 PM or 4 PM, and Wednesday at 10 AM. Which works best for you?";

    default:
      return "I'm not sure how to handle that request.";
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const audioBodyParser = express.json({ limit: "50mb" });

  app.post("/api/heygen/token", async (req: Request, res: Response) => {
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

  app.post("/api/chat/:conversationId", async (req: Request, res: Response) => {
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

  return httpServer;
}
