import { BadRequestError } from "@/app/middleware";
import { waitlist } from "@/db";
import { Request, Response } from "express";

/**
 * Admin Player Controller
 *
 * Handles administrative operations on waitlists
 * All routes require ADMIN authentication level
 */
export class AdminWaitlistController {
  /**
   * Get all waitlist entries
   *
   * GET /api/admin/waitlist
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    const entries = await waitlist.entry.getAll({
      orderBy: "submittedAt",
      orderDirection: "DESC",
    });

    res.json({
      sucess: true,
      data: entries,
      count: entries.length,
    });
  }

  /**
   * Get a single waitlist entry by ID
   *
   * GET /api/admin/waitlist/:id
   */
  static async get(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id as string);

    if (Array.isArray(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    if (isNaN(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    const entry = await waitlist.entry.get({ id });

    res.json({
      success: true,
      data: entry,
    });
  }

  /**
   * Deletes a waitlist entry
   *
   * DELETE /api/admin/waitlist/:id
   */
  static async delete(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.query.id as string);

    if (Array.isArray(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    if (isNaN(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    await waitlist.entry.delete({ id });

    res.json({
      success: true,
      message: "Waitlist entry deleted",
    });
  }

  /**
   * Get waitlist count
   *
   * GET /api/admin/waitlist/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    const total = await waitlist.entry.count();

    res.json({
      success: true,
      data: {
        total,
      },
    });
  }
}
