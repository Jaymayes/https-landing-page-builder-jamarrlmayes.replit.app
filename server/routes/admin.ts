import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { leads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, devBypassAuth } from "../middleware/auth";
import { generalApiLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * Admin Routes for Success Fee Management
 * All routes require authenticated admin user
 */

/**
 * POST /api/admin/leads/:id/collect-fee
 * Mark a Success Fee as collected (for billing audit)
 */
router.post(
  "/leads/:id/collect-fee",
  devBypassAuth,
  requireAdmin,
  generalApiLimiter,
  async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id as string);

      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }

      // Get admin user ID from Clerk auth
      const auth = (req as any).auth;
      const adminId = auth?.userId || "system";

      // Find the lead first
      const [existingLead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId));

      if (!existingLead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (existingLead.feeCollected) {
        return res.status(400).json({
          error: "Fee already collected",
          collectedAt: existingLead.feeCollectedAt,
          collectedBy: existingLead.feeCollectedBy
        });
      }

      if (!existingLead.successFeeCents || existingLead.successFeeCents === 0) {
        return res.status(400).json({ error: "No Success Fee assigned to this lead" });
      }

      // Mark fee as collected
      const [updatedLead] = await db
        .update(leads)
        .set({
          feeCollected: true,
          feeCollectedAt: new Date(),
          feeCollectedBy: adminId,
        })
        .where(eq(leads.id, leadId))
        .returning();

      console.log(`💰 Success Fee collected for lead ${leadId} by admin ${adminId}`);

      res.json({
        success: true,
        message: "Fee marked as collected",
        lead: {
          id: updatedLead.id,
          name: updatedLead.name,
          company: updatedLead.company,
          successFeeCents: updatedLead.successFeeCents,
          feeCollectedAt: updatedLead.feeCollectedAt,
          feeCollectedBy: updatedLead.feeCollectedBy,
        },
      });
    } catch (error) {
      console.error("Error collecting fee:", error);
      res.status(500).json({ error: "Failed to collect fee" });
    }
  }
);

/**
 * POST /api/admin/leads/:id/uncollect-fee
 * Reverse a fee collection (for corrections)
 */
router.post(
  "/leads/:id/uncollect-fee",
  devBypassAuth,
  requireAdmin,
  generalApiLimiter,
  async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id as string);

      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }

      const auth = (req as any).auth;
      const adminId = auth?.userId || "system";

      // Find the lead
      const [existingLead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId));

      if (!existingLead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (!existingLead.feeCollected) {
        return res.status(400).json({ error: "Fee not yet collected" });
      }

      // Reverse the collection
      const [updatedLead] = await db
        .update(leads)
        .set({
          feeCollected: false,
          feeCollectedAt: null,
          feeCollectedBy: null,
        })
        .where(eq(leads.id, leadId))
        .returning();

      console.log(`⏪ Success Fee uncollected for lead ${leadId} by admin ${adminId}`);

      res.json({
        success: true,
        message: "Fee collection reversed",
        lead: {
          id: updatedLead.id,
          name: updatedLead.name,
          successFeeCents: updatedLead.successFeeCents,
        },
      });
    } catch (error) {
      console.error("Error uncollecting fee:", error);
      res.status(500).json({ error: "Failed to uncollect fee" });
    }
  }
);

/**
 * GET /api/admin/fees/summary
 * Get summary of all Success Fees for billing
 */
router.get(
  "/fees/summary",
  devBypassAuth,
  requireAdmin,
  generalApiLimiter,
  async (req: Request, res: Response) => {
    try {
      const allLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.scheduledCall, true));

      const summary = {
        totalBooked: allLeads.length,
        withFees: allLeads.filter((l) => l.successFeeCents && l.successFeeCents > 0).length,
        totalFeeCents: allLeads.reduce((sum, l) => sum + (l.successFeeCents || 0), 0),
        collectedFeeCents: allLeads
          .filter((l) => l.feeCollected)
          .reduce((sum, l) => sum + (l.successFeeCents || 0), 0),
        pendingFeeCents: allLeads
          .filter((l) => !l.feeCollected && l.successFeeCents && l.successFeeCents > 0)
          .reduce((sum, l) => sum + (l.successFeeCents || 0), 0),
        pendingLeads: allLeads
          .filter((l) => !l.feeCollected && l.successFeeCents && l.successFeeCents > 0)
          .map((l) => ({
            id: l.id,
            name: l.name,
            company: l.company,
            email: l.email,
            successFeeCents: l.successFeeCents,
            scheduledAt: l.scheduledAt,
          })),
      };

      res.json(summary);
    } catch (error) {
      console.error("Error fetching fee summary:", error);
      res.status(500).json({ error: "Failed to fetch fee summary" });
    }
  }
);

export default router;
