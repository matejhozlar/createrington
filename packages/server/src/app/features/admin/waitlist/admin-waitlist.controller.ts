import type { Request, Response } from "express";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "@/app/middleware";
import { waitlistRepo } from "@/db";
import type {
  GetAdminWaitlistEntriesResponse,
  GetAdminWaitlistEntryResponse,
  InviteWaitlistEntryResponse,
  DeleteWaitlistEntryResponse,
  GetAdminWaitlistStatsResponse,
} from "@createrington/shared/api";

/**
 * Admin Waitlist Controller
 *
 * Handles administrative operations on waitlist entries
 * All routes require ADMIN authentication level
 */
export class AdminWaitlistController {
  /**
   * GET /api/admin/waitlist/:id
   *
   * Get detailed waitlist entry information
   *
   * Path Parameters:
   * - id: Waitlist entry ID
   *
   * @example
   * GET /api/admin/waitlist/123
   */
  static async getEntry(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (Array.isArray(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      throw new BadRequestError("Invalid entry ID. Must be a number.");
    }

    try {
      const entry = await waitlistRepo.getDetailed(entryId);

      const response: GetAdminWaitlistEntryResponse = {
        success: true,
        data: {
          entry: {
            ...entry,
            submittedAt: entry.submittedAt.toISOString(),
            acceptedAt: entry.acceptedAt?.toISOString() || null,
          },
        },
      };

      res.json(response);
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }
      logger.error("Failed to fetch waitlist entry:", error);
      throw new InternalServerError("Failed to fetch waitlist entry");
    }
  }

  /**
   * GET /api/admin/waitlist
   *
   * Get list of waitlist entries with filtering and pagination
   *
   * Query Parameters:
   * Filtering:
   * - status: Filter by status (pending/accepted/rejected)
   * - email: Filter by email (case-insensitive partial match)
   * - discord_name: Filter by Discord name (case-insensitive partial match)
   * - discord_id: Filter by Discord ID
   * - verified: Filter by verification status (true/false)
   * - registered: Filter by registration status (true/false)
   *
   * Pagination:
   * - page: Page number (0-indexed, default: 0)
   * - limit: Results per page (1-100, default: 20)
   *
   * Sorting:
   * - sort_by: Field to sort by (submittedAt, acceptedAt, email, discordName)
   * - sort_order: Sort direction (asc/desc, default: desc)
   *
   * @example
   * GET /api/admin/waitlist?status=pending&limit=50
   * GET /api/admin/waitlist?verified=true&sort_by=submittedAt
   */
  static async getEntries(req: Request, res: Response): Promise<void> {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );

    const sortBy = (req.query.sortBy as string) || "submittedAt";
    const sortOrder =
      (req.query.sortOrder as string)?.toLowerCase() === "asc" ? "ASC" : "DESC";

    const filters: any = {};

    if (req.query.status) {
      filters.status = req.query.status as string;
    }

    if (req.query.email) {
      filters.email = {
        $ilike: `%${req.query.email}%`,
      };
    }

    if (req.query.discordName) {
      filters.discordName = {
        $ilike: `%${req.query.discordName}%`,
      };
    }

    if (req.query.discordId) {
      filters.discordId = req.query.discordId as string;
    }

    if (req.query.verified !== undefined) {
      filters.verified = req.query.verified === "true";
    }

    if (req.query.registered !== undefined) {
      filters.registered = req.query.registered === "true";
    }

    const validSortFields = [
      "submittedAt",
      "acceptedAt",
      "email",
      "discordName",
    ];
    const orderBy = validSortFields.includes(sortBy)
      ? (sortBy as any)
      : "submittedAt";

    try {
      const [entries, total] = await Promise.all([
        waitlistRepo.getAll(filters, {
          orderBy,
          orderDirection: sortOrder,
          limit,
          offset: page * limit,
        }),
        waitlistRepo.count(filters),
      ]);

      const response: GetAdminWaitlistEntriesResponse = {
        success: true,
        data: {
          entries: entries.map((entry) => ({
            ...entry,
            submittedAt: entry.submittedAt.toISOString(),
            acceptedAt: entry.acceptedAt?.toISOString() || null,
          })) as any,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch waitlist entries:", error);
      throw new InternalServerError("Failed to fetch waitlist entries");
    }
  }

  /**
   * POST /api/admin/waitlist/:id/invite
   *
   * Manually invite a waitlist entry
   *
   * Path Parameters:
   * - id: Waitlist entry ID
   *
   * Body:
   * {
   *   reason?: string
   * }
   */
  static async inviteEntry(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { reason } = req.body;

    if (Array.isArray(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      throw new BadRequestError("Invalid entry ID. Must be a number.");
    }

    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    try {
      const updatedEntry = await waitlistRepo.manualInvite(
        entryId,
        req.user.discordId,
      );

      const response: InviteWaitlistEntryResponse = {
        success: true,
        data: {
          entry: {
            ...updatedEntry,
            submittedAt: updatedEntry.submittedAt.toISOString(),
            acceptedAt: updatedEntry.acceptedAt?.toISOString() || null,
          } as any,
        },
        message: "Waitlist entry invited successfully",
      };

      res.json(response);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      logger.error("Failed to invite waitlist entry:", error);
      throw new InternalServerError("Failed to invite waitlist entry");
    }
  }

  /**
   * DELETE /api/admin/waitlist/:id
   *
   * Delete a waitlist entry
   *
   * Path Parameters:
   * - id: Waitlist entry ID
   *
   * Body:
   * {
   *   reason: string
   * }
   */
  static async deleteEntry(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { reason } = req.body;

    if (Array.isArray(id)) {
      throw new BadRequestError("Invalid entry ID");
    }

    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      throw new BadRequestError("Invalid entry ID. Must be a number.");
    }

    if (!reason) {
      throw new BadRequestError("Reason is required for entry deletion");
    }

    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    try {
      await waitlistRepo.adminDelete(
        entryId,
        req.user.discordId,
        req.user.username,
        reason,
      );

      const response: DeleteWaitlistEntryResponse = {
        success: true,
        message: "Waitlist entry deleted successfully",
      };

      res.json(response);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        throw error;
      }
      logger.error("Failed to delete waitlist entry:", error);
      throw new InternalServerError("Failed to delete waitlist entry");
    }
  }

  /**
   * GET /api/admin/waitlist/stats
   *
   * Get overall waitlist statistics for admin dashboard
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await waitlistRepo.getStats();

      const response: GetAdminWaitlistStatsResponse = {
        success: true,
        data: stats,
      };

      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch waitlist stats:", error);
      throw new InternalServerError("Failed to fetch waitlist stats");
    }
  }
}
