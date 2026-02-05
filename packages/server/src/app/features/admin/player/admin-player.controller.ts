import type { Request, Response } from "express";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "@/app/middleware";
import { idToObject } from "@/app/utils/helpers";
import {
  type GetAdminPlayerResponse,
  type GetAdminPlayersResponse,
  type UpdateAdminPlayerResponse,
  type GetPlayerBalanceResponse,
  type AdjustPlayerBalanceResponse,
  type GetPlayerAuditLogResponse,
  type GetPlayerPlaytimeResponse,
  type GetPlayerSessionsResponse,
  type GetPlayerTicketsResponse,
  type GetAdminPlayerStatsResponse,
  type BulkBalanceAdjustResponse,
  type GetPlayerStrikesResponse,
  type IssueStrikeResponse,
  type RemoveStrikeResponse,
  GetPlayerParamsSchema,
  GetAdminPlayersQuerySchema,
  UpdateAdminPlayerBodySchema,
  GetPlayerBalanceQuerySchema,
  AdjustPlayerBalanceBodySchema,
  GetPlayerAuditLogQuerySchema,
  GetPlayerSessionsQuerySchema,
  GetPlayerTicketsQuerySchema,
  GetPlayerStrikesQuerySchema,
  IssueStrikeBodySchema,
  RemoveStrikeParamsSchema,
  RemoveStrikeBodySchema,
  BulkBalanceAdjustBodySchema,
  GetPlayerBansQuerySchema,
  type GetPlayerBansResponse,
  IssueTemporaryBanBodySchema,
  type IssueTemporaryBanResponse,
  IssuePermanentBanBodySchema,
  type IssuePermanentBanResponse,
  UnbanParamsSchema,
  UnbanBodySchema,
  type UnbanResponse,
  type GetRecentBansResponse,
} from "@createrington/shared/api";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { z } from "zod";
import { playerService } from "@/services/player";
import { balanceRepo } from "@/db";
import type { PlayerBan } from "@createrington/shared/db";

/**
 * Admin Player Controller
 *
 * Handles administrative operations on players
 * All routes require ADMIN authentication level
 */
export class AdminPlayerController {
  /**
   * GET /api/admin/players/:id
   *
   * Get detailed player information for admin panel
   *
   * Path Parameters:
   * - id: Discord ID (17-20 digits) or Minecraft UUID (UUID format)
   *
   * @example
   * GET /api/admin/players/123456789012345678
   * GET /api/admin/players/550e8400-e29b-41d4-a716-446655440000
   */
  static async getPlayer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const playerData = await playerService.getComprehensive(identifier);

      const response: GetAdminPlayerResponse = {
        success: true,
        data: {
          player: {
            ...playerData.player,
            createdAt: playerData.player.createdAt.toISOString(),
            updatedAt: playerData.player.updatedAt.toISOString(),
            lastSeen: playerData.player.lastSeen.toISOString(),
          },
          balance: playerData.balance
            ? {
                minecraftUuid: playerData.balance.minecraftUuid,
                balance: BalanceUtils.fromStorage(
                  playerData.balance.balance,
                ).toString(),
                updatedAt: playerData.balance.updatedAt.toISOString(),
              }
            : null,
          playtime: {
            summary: playerData.playtime.summary.map((s) => ({
              playerMinecraftUuid: s.playerMinecraftUuid,
              serverId: s.serverId,
              totalSeconds: s.totalSeconds.toString(),
              totalSessions: s.totalSessions,
              avgSessionSeconds: s.avgSessionSeconds?.toString() || "0",
              firstSeen: s.firstSeen?.toISOString() || null,
              lastSeen: s.lastSeen?.toISOString() || null,
              updatedAt: s.updatedAt.toISOString(),
            })),
            totalSeconds: playerData.playtime.totalSeconds,
            totalSessions: playerData.playtime.totalSessions,
          },
          tickets: playerData.tickets,
          waitlist: playerData.waitlist
            ? {
                ...playerData.waitlist,
                submittedAt: playerData.waitlist.submittedAt.toISOString(),
                acceptedAt:
                  playerData.waitlist.acceptedAt?.toISOString() || null,
              }
            : null,
          strikes: {
            all: playerData.strikes.all.map((s) => ({
              ...s,
              issuedAt: s.issuedAt.toISOString(),
              removedAt: s.removedAt?.toISOString() || null,
            })),
            active: playerData.strikes.active.map((s) => ({
              ...s,
              issuedAt: s.issuedAt.toISOString(),
              removedAt: s.removedAt?.toISOString() || null,
            })),
            activeCount: playerData.strikes.activeCount,
            totalCount: playerData.strikes.totalCount,
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
      logger.error("Failed to fetch player:", error);
      throw new InternalServerError("Failed to fetch player data");
    }
  }

  /**
   * GET /api/admin/players
   *
   * Get list of players with enhanced admin data
   *
   * Query Parameters:
   * Filtering:
   * - discordId: Filter by Discord ID
   * - minecraftUuid: Filter by Minecraft UUID
   * - minecraftUsername: Filter by username (case-insensitive partial match)
   * - online: Filter by online status (true/false)
   *
   * Pagination:
   * - page: Page number (0-indexed, default: 0)
   * - limit: Results per page (1-100, default: 20)
   *
   * Sorting:
   * - sortBy: Field to sort by (createdAt, minecraftUsername, updatedAt, lastSeen)
   * - sortOrder: Sort direction (asc/desc, default: desc)
   *
   * @example
   * GET /api/admin/players?limit=50&online=true
   * GET /api/admin/players?minecraft_username=Steve&sort_by=lastSeen
   */
  static async getPlayers(req: Request, res: Response): Promise<void> {
    try {
      // Validate and transform query parameters
      const query = GetAdminPlayersQuerySchema.parse(req.query);

      // Build filters
      const filters: any = {};

      if (query.discordId) {
        filters.discordId = req.query.discordId;
      }

      if (query.minecraftUuid) {
        filters.minecraftUuid = req.query.minecraftUuid;
      }

      if (query.minecraftUsername) {
        filters.minecraftUsername = {
          $ilike: `%${req.query.minecraftUsername}%`,
        };
      }

      if (query.online !== undefined) {
        filters.online = req.query.online;
      }

      const { orderBy, orderDirection, page, limit, includeStrikeCounts } =
        query;

      const [players, total] = await Promise.all([
        playerService.core.getAll(filters, {
          orderBy,
          orderDirection,
          limit,
          offset: page * limit,
        }),
        playerService.core.count(filters),
      ]);

      let playersWithStrikes = players as any;
      if (includeStrikeCounts) {
        const playerUuids = players.map((p) => p.minecraftUuid);
        const strikeCounts =
          await playerService.strikes.getActiveStrikeCounts(playerUuids);

        playersWithStrikes = players.map((player) => ({
          ...player,
          activeStrikeCount: strikeCounts[player.minecraftUuid] ?? 0,
        }));
      }

      const response: GetAdminPlayersResponse = {
        success: true,
        data: {
          players: playersWithStrikes,
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
      logger.error("Failed to fetch players:", error);
      throw new InternalServerError("Failed to update player");
    }
  }

  /**
   * PATCH /api/admin/players/:id
   *
   * Update player data
   *
   * Path Parameters:
   * - id: Discord ID or Minecraft UUID
   *
   * Body:
   * {
   *   minecraftUsername?: string,
   *   discordId?: string,
   *   reason: string
   * }
   */
  static async updatePlayer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { minecraftUsername, discordId, reason } =
        UpdateAdminPlayerBodySchema.parse(req.body);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      if (!minecraftUsername && !discordId) {
        throw new BadRequestError("At least one field to update is required");
      }

      const updates: any = {};
      if (minecraftUsername) updates.minecraftUsername = minecraftUsername;
      if (discordId) updates.discordId = discordId;

      const updatedPlayer = await playerService.core.adminUpdate(
        identifier,
        updates,
        req.user.discordId,
        req.user.username,
        reason,
      );

      const response: UpdateAdminPlayerResponse = {
        success: true,
        data: {
          player: updatedPlayer as any,
        },
        message: "Player updated successfully",
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
      logger.error("Failed to update player:", error);
      throw new InternalServerError("Failed to update player");
    }
  }

  /**
   * DELETE /api/admin/players/:id
   *
   * Completely delete a player and all associated data
   *
   * Path Parameters:
   * - id: Discord ID or Minecraft UUID
   *
   * Body:
   * {
   *   reason: string
   * }
   */
  static async deletePlayer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { reason } = req.body;

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      await playerService.core.adminDelete(
        identifier,
        req.user.discordId,
        req.user.username,
        reason,
      );

      res.json({
        success: true,
        message: "Player deleted successfully",
      });
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
      logger.error("Failed to delete player:", error);
      throw new InternalServerError("Failed to delete player");
    }
  }

  /**
   * GET /api/admin/players/:id/balance
   *
   * Get player balance with recent transactions
   *
   * Query Parameters:
   * - limit: Number of recent transactions (default: 10, max: 100)
   */
  static async getPlayerBalance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { limit } = GetPlayerBalanceQuerySchema.parse(req.query);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const balanceInfo = await playerService.core.getBalanceInfo(
        identifier,
        limit,
      );

      const response: GetPlayerBalanceResponse = {
        success: true,
        data: {
          balance: {
            ...balanceInfo.balance,
            balance: balanceInfo.balance.balance.toString(),
          } as any,
          formattedBalance: balanceInfo.formattedBalance,
          recentTransactions: balanceInfo.recentTransactions.map((t) => ({
            ...t,
            amount: t.amount.toString(),
            balanceBefore: t.balanceBefore.toString(),
            balanceAfter: t.balanceAfter.toString(),
          })) as any,
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
      logger.error("Failed to fetch player balance:", error);
      throw new InternalServerError("Failed to fetch player balance");
    }
  }

  /**
   * POST /api/admin/players/:id/balance/adjust
   *
   * Adjust player balance (add or subtract)
   *
   * Body:
   * {
   *   amount: number,     // Positive to add, negative to subtract
   *   reason: string
   * }
   */
  static async adjustPlayerBalance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { amount, reason } = AdjustPlayerBalanceBodySchema.parse(req.body);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      let newBalance: number;

      if (amount > 0) {
        newBalance = await balanceRepo.adminGrant(
          identifier,
          amount,
          req.user.discordId,
          req.user.username,
          reason,
        );
      } else if (amount < 0) {
        newBalance = await balanceRepo.adminDeduct(
          identifier,
          Math.abs(amount),
          req.user.discordId,
          req.user.username,
          reason,
        );
      } else {
        throw new BadRequestError("Amount cannot be zero");
      }

      const response: AdjustPlayerBalanceResponse = {
        success: true,
        data: {
          newBalance,
          adjustment: amount,
        },
        message: "Balance adjusted successfully",
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
      logger.error("Failed to adjust player balance:", error);
      throw new InternalServerError("Failed to adjust player balance");
    }
  }

  /**
   * GET /api/admin/players/:id/audit-log
   *
   * Get admin action audit log for a player
   *
   * Query Parameters:
   * - page: Page number (0-indexed, default: 0)
   * - limit: Number of actions (default: 20, max: 100)
   */
  static async getPlayerAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { page, limit } = GetPlayerAuditLogQuerySchema.parse(req.query);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const [auditLog, total] = await Promise.all([
        playerService.audit.getLog(identifier, limit, page * limit),
        playerService.audit.count(identifier),
      ]);

      const response: GetPlayerAuditLogResponse = {
        success: true,
        data: {
          actions: auditLog.map((action) => ({
            id: action.id,
            adminDiscordId: action.adminDiscordId,
            adminDiscordUsername: action.adminDiscordUsername,
            actionType: action.actionType,
            targetPlayerUuid: action.targetPlayerUuid,
            targetPlayerName: action.targetPlayerName,
            tableName: action.tableName,
            fieldName: action.fieldName,
            oldValue: action.oldValue,
            newValue: action.newValue,
            reason: action.reason,
            serverId: action.serverId,
            performedAt: action.performedAt.toISOString(),
            metadata: action.metadata,
          })),
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
      logger.error("Failed to fetch player audit:", error);
      throw new InternalServerError("Failed to fetch player audit");
    }
  }

  /**
   * GET /api/admin/players/:id/playtime
   *
   * Get player playtime statistics
   */
  static async getPlayerPlaytime(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const playerData = await playerService.core.getDetailed(identifier);

      const response: GetPlayerPlaytimeResponse = {
        success: true,
        data: {
          summary: playerData.playtime.summary.map((s) => ({
            ...s,
            totalSeconds: s.totalSeconds.toString(),
            avgSessionSeconds: s.avgSessionSeconds?.toString() || "0",
          })) as any,
          totalSeconds: playerData.playtime.totalSeconds,
          totalSessions: playerData.playtime.totalSessions,
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
      logger.error("Failed to fetch player playtime:", error);
      throw new InternalServerError("Failed to fetch player playtime");
    }
  }

  /**
   * GET /api/admin/players/:id/sessions
   *
   * Get player session history
   *
   * Query Parameters:
   * - server_id: Filter by server ID
   * - limit: Number of sessions (default: 50, max: 200)
   */
  static async getPlayerSessions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { serverId, page, limit } = GetPlayerSessionsQuerySchema.parse(
        req.query,
      );

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      // Get total count
      const totalSessions = await playerService.sessions.count(
        identifier,
        serverId,
      );

      // Get paginated sessions
      const sessions = await playerService.sessions.getHistory(
        identifier,
        serverId,
        limit,
        page * limit,
      );

      const response: GetPlayerSessionsResponse = {
        success: true,
        data: {
          sessions: sessions.map((s) => ({
            ...s,
            secondsPlayed: s.secondsPlayed?.toString() || null,
          })) as any,
          pagination: {
            page,
            limit,
            total: totalSessions,
            totalPages: Math.ceil(totalSessions / limit),
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
      logger.error("Failed to fetch player sessions:", error);
      throw new InternalServerError("Failed to fetch player sessions");
    }
  }

  /**
   * GET /api/admin/players/:id/tickets
   *
   * Get all tickets for a player
   */
  static async getPlayerTickets(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { page, limit } = GetPlayerTicketsQuerySchema.parse(req.query);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const [tickets, total] = await Promise.all([
        playerService.tickets.getAll(identifier, limit, page * limit),
        playerService.tickets.count(identifier),
      ]);

      const response: GetPlayerTicketsResponse = {
        success: true,
        data: {
          tickets: tickets as any,
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
      logger.error("Failed to fetch player tickets:", error);
      throw new InternalServerError("Failed to fetch player tickets");
    }
  }

  /**
   * GET /api/admin/players/:id/strikes
   *
   * Get all strikes for a player
   *
   * Query Parameters:
   * - activeOnly: Filter to only active strikes (true/false)
   */
  static async getPlayerStrikes(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { activeOnly } = GetPlayerStrikesQuerySchema.parse(req.query);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const [strikes, statistics] = await Promise.all([
        playerService.strikes.get(identifier, activeOnly),
        playerService.strikes.getStatistics(identifier),
      ]);

      const response: GetPlayerStrikesResponse = {
        success: true,
        data: {
          strikes: strikes as any,
          statistics: {
            ...statistics,
            mostRecent: statistics.mostRecent?.toISOString(),
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
      logger.error("Failed to fetch player strikes:", error);
      throw new InternalServerError("Failed to fetch player strikes");
    }
  }

  /**
   * POST /api/admin/players/:id/strikes
   *
   * Issue a strike to a player
   *
   * Body:
   * {
   *   classification: StrikeClassification,
   *   description: string,
   *   severity: 1-5,
   *   serverId?: number,
   *   metadata?: Record<string, any>
   * }
   */
  static async issueStrike(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { classification, description, severity, serverId, metadata } =
        IssueStrikeBodySchema.parse(req.body);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const strike = await playerService.strikes.issue(
        identifier,
        {
          classification,
          description,
          severity,
          serverId,
          metadata,
        },
        req.user.discordId,
        req.user.username,
      );

      const response: IssueStrikeResponse = {
        success: true,
        data: {
          strike: strike as any,
        },
        message: "Strike issued successfully",
      };

      res.status(201).json(response);
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
      logger.error("Failed to issue player strike:", error);
      throw new InternalServerError("Failed to issue player strike");
    }
  }

  /**
   * DELETE /api/admin/players/:id/strikes/:strikeId
   *
   * Remove/pardon a strike
   *
   * Body:
   * {
   *   reason: string
   * }
   */
  static async removeStrike(req: Request, res: Response): Promise<void> {
    try {
      const { id, strikeId } = RemoveStrikeParamsSchema.parse(req.params);
      const { reason } = RemoveStrikeBodySchema.parse(req.body);

      const strike = await playerService.strikes.remove(
        strikeId,
        req.user.discordId,
        req.user.username,
        reason,
      );

      const response: RemoveStrikeResponse = {
        success: true,
        data: {
          strike: strike as any,
        },
        message: "Strike removed successfully",
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
      logger.error("Failed to remove player strike:", error);
      throw new InternalServerError("Failed to remove player strike");
    }
  }

  /**
   * GET /api/admin/players/stats
   *
   * Get overall player statistics for admin dashboard
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await playerService.core.getStats();

      const response: GetAdminPlayerStatsResponse = {
        success: true,
        data: stats,
      };

      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch player stats:", error);
      throw new InternalServerError("Failed to fetch player stats");
    }
  }

  /**
   * POST /api/admin/players/bulk/balance
   *
   * Bulk balance adjustment for multiple players
   *
   * Body:
   * {
   *   playerUuids: string[],
   *   amount: number,
   *   reason: string
   * }
   */
  static async bulkBalanceAdjust(req: Request, res: Response): Promise<void> {
    try {
      const { playerUuids, amount, reason } = BulkBalanceAdjustBodySchema.parse(
        req.body,
      );

      const results = await playerService.balance.bulkAdjust(
        playerUuids,
        amount,
        req.user.discordId,
        req.user.username,
        reason,
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      const response: BulkBalanceAdjustResponse = {
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount,
          },
        },
        message: `Bulk balance adjustment completed: ${successCount} successful, ${failureCount} failed`,
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
      logger.error("Failed to bulk adjust balance:", error);
      throw new InternalServerError("Failed to bulk adjust balance");
    }
  }

  /**
   * GET /api/admin/players/:id/bans
   *
   * Get all bans for a player
   *
   * Query Parameters:
   * - includeUnbanned: Include unbanned entries (true/false, default: false)
   */
  static async getPlayerBans(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { includeUnbanned } = GetPlayerBansQuerySchema.parse(req.query);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const [bans, statistics, currentBan] = await Promise.all([
        playerService.bans.getHistory(identifier, includeUnbanned ?? false),
        playerService.bans.getStatistics(identifier),
        playerService.bans.getCurrent(identifier),
      ]);

      const response: GetPlayerBansResponse = {
        success: true,
        data: {
          bans: bans.map((b: PlayerBan) => ({
            ...b,
            bannedAt: b.bannedAt.toISOString(),
            expiresAt: b.expiresAt?.toISOString() || null,
            unbannedAt: b.unbannedAt?.toISOString() || null,
          })) as any,
          statistics: {
            ...statistics,
          } as any,
          current: currentBan
            ? ({
                ...currentBan,
                bannedAt: currentBan.bannedAt.toISOString(),
                expiresAt: currentBan.expiresAt?.toISOString() || null,
                unbannedAt: currentBan.unbannedAt?.toISOString() || null,
              } as any)
            : null,
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
      logger.error("Failed to fetch player bans:", error);
      throw new InternalServerError("Failed to fetch player bans");
    }
  }

  /**
   * POST /api/admin/players/:id/bans/temporary
   *
   * Issue a temporary ban to a player
   *
   * Body:
   * {
   *   reason: string,
   *   durationDays: number,
   *   serverId?: number,
   *   metadata?: Record<string, any>
   * }
   */
  static async issueTemporaryBan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { reason, durationDays, serverId, metadata } =
        IssueTemporaryBanBodySchema.parse(req.body);

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const expiresAt = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000,
      );

      const ban = await playerService.bans.issueTemporary(
        identifier,
        {
          reason,
          expiresAt,
          serverId,
          metadata,
        },
        req.user.discordId,
        req.user.username,
      );

      const response: IssueTemporaryBanResponse = {
        success: true,
        data: {
          ban: {
            ...ban,
            bannedAt: ban.bannedAt.toISOString(),
            expiresAt: ban.expiresAt?.toISOString() || null,
            unbannedAt: ban.unbannedAt?.toISOString() || null,
          } as any,
        },
        message: `Player temporarily banned for ${durationDays} days`,
      };

      res.status(201).json(response);
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
      logger.error("Failed to issue temporary ban:", error);
      throw new InternalServerError("Failed to issue temporary ban");
    }
  }

  /**
   * POST /api/admin/players/:id/bans/permanent
   *
   * Issue a permanent ban to a player (deletes all player data)
   *
   * Body:
   * {
   *   reason: string,
   *   serverId?: number,
   *   metadata?: Record<string, any>
   * }
   */
  static async issuePermanentBan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = GetPlayerParamsSchema.parse(req.params);
      const { reason, serverId, metadata } = IssuePermanentBanBodySchema.parse(
        req.body,
      );

      const identifier = idToObject(id);
      if (!identifier) {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        );
      }

      const ban = await playerService.bans.issuePermanent(
        identifier,
        {
          reason,
          serverId,
          metadata,
        },
        req.user.discordId,
        req.user.username,
      );

      const response: IssuePermanentBanResponse = {
        success: true,
        data: {
          banId: ban.id,
        },
        message: "Player permanently banned and deleted",
      };

      res.status(201).json(response);
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
      logger.error("Failed to issue permanent ban:", error);
      throw new InternalServerError("Failed to issue permanent ban");
    }
  }

  /**
   * DELETE /api/admin/bans/:banId
   *
   * Unban/pardon a player
   *
   * Body:
   * {
   *   reason: string
   * }
   */
  static async unbanPlayer(req: Request, res: Response): Promise<void> {
    try {
      const { banId } = UnbanParamsSchema.parse(req.params);
      const { reason } = UnbanBodySchema.parse(req.body);

      const ban = await playerService.bans.unban(
        banId,
        req.user.discordId,
        req.user.username,
        reason,
      );

      const response: UnbanResponse = {
        success: true,
        data: {
          ban: {
            ...ban,
            bannedAt: ban.bannedAt.toISOString(),
            expiresAt: ban.expiresAt?.toISOString() || null,
            unbannedAt: ban.unbannedAt?.toISOString() || null,
          } as any,
        },
        message: "Player unbanned successfully",
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
      logger.error("Failed to unban player:", error);
      throw new InternalServerError("Failed to unban player");
    }
  }

  /**
   * GET /api/admin/bans/recent
   *
   * Get recent bans across all players
   *
   * Query Parameters:
   * - limit: Number of bans to return (default: 50, max: 200)
   * - activeOnly: Only active bans (default: true)
   */
  static async getRecentBans(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const activeOnly = (req.query.activeOnly as string) !== "false";

      const bans = await playerService.bans.getRecent(limit, activeOnly);

      const response: GetRecentBansResponse = {
        success: true,
        data: {
          bans: bans.map((b) => ({
            ...b,
            bannedAt: b.bannedAt.toISOString(),
            expiresAt: b.expiresAt?.toISOString() || null,
            unbannedAt: b.unbannedAt?.toISOString() || null,
          })) as any,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Failed to fetch recent bans:", error);
      throw new InternalServerError("Failed to fetch recent bans");
    }
  }
}
