import type { Request, Response } from "express";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "@/app/middleware";
import { waitlistRepo } from "@/db";
import {
  type GetAdminWaitlistEntriesResponse,
  type GetAdminWaitlistEntryResponse,
  type InviteWaitlistEntryResponse,
  type DeleteWaitlistEntryResponse,
  type GetAdminWaitlistStatsResponse,
  GetWaitlistParamsSchema,
  GetAdminWaitlistEntriesQuerySchema,
  InviteWaitlistEntryBodySchema,
  DeleteWaitlistEntryBodySchema,
} from "@createrington/shared/api";
import z from "zod";

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
    try {
      const { id } = GetWaitlistParamsSchema.parse(req.params);
      const entry = await waitlistRepo.getDetailed(id);

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
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }
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
   * - status: Filter by status (pending/accepted/declined)
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
   * - sortBy: Field to sort by (submittedAt, acceptedAt, email, discordName)
   * - sortOrder: Sort direction (asc/desc, default: desc)
   *
   * @example
   * GET /api/admin/waitlist?status=pending&limit=50
   * GET /api/admin/waitlist?verified=true&sort_by=submittedAt
   */
  static async getEntries(req: Request, res: Response): Promise<void> {
    try {
      const query = GetAdminWaitlistEntriesQuerySchema.parse(req.query);
      const { page, limit, orderBy, orderDirection } = query;

      const filters: any = {};

      if (query.status) {
        filters.status = query.status;
      }

      if (query.email) {
        filters.email = {
          $ilike: `%${query.email}%`,
        };
      }

      if (query.discordName) {
        filters.discordName = {
          $ilike: `%${query.discordName}%`,
        };
      }

      if (query.discordId) {
        filters.discordId = query.discordId;
      }

      if (query.verified !== undefined) {
        filters.verified = query.verified === true;
      }

      if (query.registered !== undefined) {
        filters.registered = query.registered === true;
      }

      const [entries, total] = await Promise.all([
        waitlistRepo.getAll(filters, {
          orderBy,
          orderDirection,
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
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }
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
    try {
      const { id } = GetWaitlistParamsSchema.parse(req.params);
      const { reason } = InviteWaitlistEntryBodySchema.parse(req.body);

      if (!req.user) {
        throw new BadRequestError("User not authenticated");
      }

      const updatedEntry = await waitlistRepo.manualInvite(
        id,
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
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof InternalServerError
      ) {
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
    const { id } = GetWaitlistParamsSchema.parse(req.params);
    const { reason } = DeleteWaitlistEntryBodySchema.parse(req.body);

    if (!reason) {
      throw new BadRequestError("Reason is required for entry deletion");
    }

    if (!req.user) {
      throw new BadRequestError("User not authenticated");
    }

    try {
      await waitlistRepo.adminDelete(
        id,
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
      if (error instanceof z.ZodError) {
        throw new BadRequestError(
          error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", "),
        );
      }
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof InternalServerError
      ) {
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
