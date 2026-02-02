import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (keep existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Conversations table for chat history
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Leads table for qualified leads
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Anonymous"),
  company: text("company").notNull().default("Unknown"),
  email: text("email").notNull().default(""),
  painPoint: text("pain_point").notNull(),
  // Business Upgrades qualification fields
  companySize: text("company_size"), // "1-10", "11-50", "51-200", "200+"
  budgetConfirmed: boolean("budget_confirmed").default(false),
  leadType: text("lead_type").default("business_upgrade"), // "business_upgrade" or "venture_studio"
  isHighIntent: boolean("is_high_intent").default(false), // 51-200+ or budget confirmed
  // Status tracking
  qualified: boolean("qualified").default(false),
  scheduledCall: boolean("scheduled_call").default(false), // The "Close the Loop" flag
  // Monetization (Success Fee tracking)
  successFeeCents: integer("success_fee_cents").default(0), // $100 = 10000 cents
  successFeePolicy: text("success_fee_policy"), // e.g. "default_100_high_intent"
  feeCollected: boolean("fee_collected").default(false), // For billing tracking
  feeCollectedAt: timestamp("fee_collected_at"), // When the fee was marked collected
  feeCollectedBy: text("fee_collected_by"), // Admin user ID who collected
  // UTM Attribution (for channel performance tracking)
  utmSource: text("utm_source"), // e.g. "linkedin", "google", "twitter"
  utmMedium: text("utm_medium"), // e.g. "cpc", "social", "email"
  utmCampaign: text("utm_campaign"), // e.g. "q1_2024_launch"
  referrer: text("referrer"), // The URL the user came from
  // Calendly metadata (populated by webhook)
  calendlyEventUri: text("calendly_event_uri"),
  calendlyInviteeUri: text("calendly_invitee_uri"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  qualified: true,
  scheduledCall: true,
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
