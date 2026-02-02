import { db } from "./db";
import { users, conversations, messages, leads } from "@shared/schema";
import type { InsertUser, User, Conversation, InsertConversation, Message, InsertMessage, Lead, InsertLead } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;

  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;

  createLead(lead: InsertLead): Promise<Lead>;
  getAllLeads(): Promise<Lead[]>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  getUnscheduledLeadByEmail(email: string): Promise<Lead | undefined>;
  getLeadByCalendlyUri(calendlyInviteeUri: string): Promise<Lead | undefined>;
  markLeadAsScheduled(leadId: number, calendlyData: {
    calendlyEventUri: string;
    calendlyInviteeUri: string;
    scheduledAt: Date;
  }, isHighIntent?: boolean): Promise<Lead | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getAllConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async createConversation(title: string): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values({ title }).returning();
    return conversation;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }

  async createMessage(conversationId: number, role: string, content: string): Promise<Message> {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    // Automatically determine high-intent status based on company size and budget
    const isHighIntent = lead.companySize === "51-200" ||
                          lead.companySize === "200+" ||
                          lead.budgetConfirmed === true;

    const [newLead] = await db.insert(leads).values({
      ...lead,
      isHighIntent,
    }).returning();
    return newLead;
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead;
  }

  // Option B: Get the most recent unscheduled lead by email
  async getUnscheduledLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.email, email), eq(leads.scheduledCall, false)))
      .orderBy(desc(leads.createdAt))
      .limit(1);
    return lead;
  }

  // Idempotency check: Find lead by Calendly invitee URI (prevents duplicate webhook processing)
  async getLeadByCalendlyUri(calendlyInviteeUri: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.calendlyInviteeUri, calendlyInviteeUri));
    return lead;
  }

  // "Close the Loop" - mark lead as scheduled when Calendly webhook fires
  // Also sets Success Fee for high-intent leads (Cash Engine)
  async markLeadAsScheduled(
    leadId: number,
    calendlyData: {
      calendlyEventUri: string;
      calendlyInviteeUri: string;
      scheduledAt: Date;
    },
    isHighIntent: boolean = false
  ): Promise<Lead | undefined> {
    // Success Fee in cents (default $100 = 10000 cents)
    const SUCCESS_FEE_CENTS = parseInt(process.env.SUCCESS_FEE_CENTS || "10000", 10);

    const [updatedLead] = await db
      .update(leads)
      .set({
        scheduledCall: true,
        calendlyEventUri: calendlyData.calendlyEventUri,
        calendlyInviteeUri: calendlyData.calendlyInviteeUri,
        scheduledAt: calendlyData.scheduledAt,
        // Set Success Fee for high-intent leads
        ...(isHighIntent && { successFeeCents: SUCCESS_FEE_CENTS }),
      })
      .where(eq(leads.id, leadId))
      .returning();
    return updatedLead;
  }
}

export const storage = new DatabaseStorage();
