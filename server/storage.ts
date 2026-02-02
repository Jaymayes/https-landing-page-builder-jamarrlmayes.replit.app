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
  markLeadAsScheduled(leadId: number, calendlyData: {
    calendlyEventUri: string;
    calendlyInviteeUri: string;
    scheduledAt: Date;
  }): Promise<Lead | undefined>;
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
    const [newLead] = await db.insert(leads).values(lead).returning();
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

  // "Close the Loop" - mark lead as scheduled when Calendly webhook fires
  async markLeadAsScheduled(
    leadId: number,
    calendlyData: {
      calendlyEventUri: string;
      calendlyInviteeUri: string;
      scheduledAt: Date;
    }
  ): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set({
        scheduledCall: true,
        calendlyEventUri: calendlyData.calendlyEventUri,
        calendlyInviteeUri: calendlyData.calendlyInviteeUri,
        scheduledAt: calendlyData.scheduledAt,
      })
      .where(eq(leads.id, leadId))
      .returning();
    return updatedLead;
  }
}

export const storage = new DatabaseStorage();
