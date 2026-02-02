import { db } from "../db";
import { leads } from "@shared/schema";
import { sql, gte, desc, eq, and } from "drizzle-orm";

/**
 * Dashboard Queries - The "Evidence Locker" for ROI Proof
 *
 * These queries power the KPI dashboard that:
 * 1. Shows the AI's "Digital Workforce Output"
 * 2. Tracks "High Intent" to "Scheduled" conversion (Success Fee metric)
 * 3. Calculates Pipeline Generated ($25k per scheduled call)
 */

// Success Fee configuration (from env or default $100)
const SUCCESS_FEE_CENTS = parseInt(process.env.SUCCESS_FEE_CENTS || "10000", 10);

export interface FunnelMetrics {
  totalVolume: number;
  highIntentCount: number;
  scheduledCount: number;
  budgetConfirmedCount: number;
  conversionRate: number;
  pipelineGenerated: number;
  // Success Fee metrics (Cash Engine)
  totalSuccessFees: number; // Total fees earned in cents
  collectedFees: number; // Fees already collected
  pendingFees: number; // Fees pending collection
  bySize: Record<string, number>;
  byType: Record<string, number>;
}

export interface LeadSegment {
  companySize: string;
  totalLeads: number;
  highIntentCount: number;
  scheduledCount: number;
  budgetConfirmedPercent: number;
  topPainPoints: string[];
}

/**
 * Get funnel metrics for a given time period
 * @param startDate - Start of the reporting period
 * @returns Aggregated funnel metrics
 */
export async function getFunnelMetrics(startDate: Date): Promise<FunnelMetrics> {
  // Main aggregation query
  const [metrics] = await db
    .select({
      totalVolume: sql<number>`count(*)::int`,
      highIntentCount: sql<number>`sum(case when ${leads.isHighIntent} then 1 else 0 end)::int`,
      scheduledCount: sql<number>`sum(case when ${leads.scheduledCall} then 1 else 0 end)::int`,
      budgetConfirmedCount: sql<number>`sum(case when ${leads.budgetConfirmed} then 1 else 0 end)::int`,
      // Success Fee aggregations
      totalSuccessFees: sql<number>`coalesce(sum(${leads.successFeeCents}), 0)::int`,
      collectedFees: sql<number>`coalesce(sum(case when ${leads.feeCollected} then ${leads.successFeeCents} else 0 end), 0)::int`,
    })
    .from(leads)
    .where(gte(leads.createdAt, startDate));

  // Group by company size
  const sizeBreakdown = await db
    .select({
      size: leads.companySize,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(gte(leads.createdAt, startDate))
    .groupBy(leads.companySize);

  // Group by lead type
  const typeBreakdown = await db
    .select({
      type: leads.leadType,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(gte(leads.createdAt, startDate))
    .groupBy(leads.leadType);

  const bySize: Record<string, number> = {};
  sizeBreakdown.forEach((row) => {
    bySize[row.size || "Unknown"] = row.count;
  });

  const byType: Record<string, number> = {};
  typeBreakdown.forEach((row) => {
    byType[row.type || "unknown"] = row.count;
  });

  const totalVolume = metrics?.totalVolume || 0;
  const highIntentCount = metrics?.highIntentCount || 0;
  const scheduledCount = metrics?.scheduledCount || 0;
  const budgetConfirmedCount = metrics?.budgetConfirmedCount || 0;
  const totalSuccessFees = metrics?.totalSuccessFees || 0;
  const collectedFees = metrics?.collectedFees || 0;
  const pendingFees = totalSuccessFees - collectedFees;

  // Conversion rate: scheduled / high intent (avoid division by zero)
  const conversionRate = highIntentCount > 0
    ? Math.round((scheduledCount / highIntentCount) * 100)
    : 0;

  // Pipeline generated: $25k average setup fee per scheduled call
  const AVERAGE_SETUP_FEE = 25000;
  const pipelineGenerated = scheduledCount * AVERAGE_SETUP_FEE;

  return {
    totalVolume,
    highIntentCount,
    scheduledCount,
    budgetConfirmedCount,
    conversionRate,
    pipelineGenerated,
    totalSuccessFees,
    collectedFees,
    pendingFees,
    bySize,
    byType,
  };
}

/**
 * Get segmented lead data by company size
 * This powers the "Business Upgrade Proof" table
 */
export async function getLeadSegments(startDate: Date): Promise<LeadSegment[]> {
  const segments = await db
    .select({
      companySize: leads.companySize,
      totalLeads: sql<number>`count(*)::int`,
      highIntentCount: sql<number>`sum(case when ${leads.isHighIntent} then 1 else 0 end)::int`,
      scheduledCount: sql<number>`sum(case when ${leads.scheduledCall} then 1 else 0 end)::int`,
      budgetConfirmedCount: sql<number>`sum(case when ${leads.budgetConfirmed} then 1 else 0 end)::int`,
    })
    .from(leads)
    .where(gte(leads.createdAt, startDate))
    .groupBy(leads.companySize);

  // Get top pain points per segment
  const painPointsBySize = await db
    .select({
      companySize: leads.companySize,
      painPoint: leads.painPoint,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(gte(leads.createdAt, startDate))
    .groupBy(leads.companySize, leads.painPoint)
    .orderBy(desc(sql`count(*)`));

  // Group pain points by size
  const painPointsMap: Record<string, string[]> = {};
  painPointsBySize.forEach((row) => {
    const size = row.companySize || "Unknown";
    if (!painPointsMap[size]) {
      painPointsMap[size] = [];
    }
    if (painPointsMap[size].length < 3) {
      painPointsMap[size].push(row.painPoint);
    }
  });

  return segments.map((seg) => {
    const size = seg.companySize || "Unknown";
    return {
      companySize: size,
      totalLeads: seg.totalLeads,
      highIntentCount: seg.highIntentCount,
      scheduledCount: seg.scheduledCount,
      budgetConfirmedPercent: seg.totalLeads > 0
        ? Math.round((seg.budgetConfirmedCount / seg.totalLeads) * 100)
        : 0,
      topPainPoints: painPointsMap[size] || [],
    };
  });
}

/**
 * Get recent leads for the activity feed
 */
export async function getRecentLeads(limit = 10) {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      email: leads.email,
      painPoint: leads.painPoint,
      companySize: leads.companySize,
      isHighIntent: leads.isHighIntent,
      scheduledCall: leads.scheduledCall,
      budgetConfirmed: leads.budgetConfirmed,
      leadType: leads.leadType,
      createdAt: leads.createdAt,
      scheduledAt: leads.scheduledAt,
    })
    .from(leads)
    .orderBy(desc(leads.createdAt))
    .limit(limit);
}

/**
 * Get daily lead counts for trend chart (last 30 days)
 */
export async function getDailyLeadTrend(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const dailyCounts = await db
    .select({
      date: sql<string>`date_trunc('day', ${leads.createdAt})::date::text`,
      total: sql<number>`count(*)::int`,
      highIntent: sql<number>`sum(case when ${leads.isHighIntent} then 1 else 0 end)::int`,
      scheduled: sql<number>`sum(case when ${leads.scheduledCall} then 1 else 0 end)::int`,
    })
    .from(leads)
    .where(gte(leads.createdAt, startDate))
    .groupBy(sql`date_trunc('day', ${leads.createdAt})`)
    .orderBy(sql`date_trunc('day', ${leads.createdAt})`);

  return dailyCounts;
}
