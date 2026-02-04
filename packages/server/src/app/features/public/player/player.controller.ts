import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "@/app/middleware";
import { getIdType } from "@/app/utils/helpers";
import { Q } from "@/db";
import {
  GetPlayerParamsSchema,
  GetPlayersQuerySchema,
  GetPlayersCountQuerySchema,
  type GetPlayerResponse,
  type GetPlayersCountResponse,
  type GetPlayersResponse,
} from "@createrington/shared/api";
import type { Request, Response } from "express";
import { z } from "zod";

/**
 * Player controller
 *
 * Handles player data retrieval with filtering and querying
 */
export class PlayerController {
  /**
   * GET /api/players/:id
   *
   * Retrieves a single player by Discord ID or Minecraft UUID
   *
   * Path Parameters:
   * - id: Discord ID (17-20 digits) or Minecraft UUID (UUID format)
   *
   * @example
   * GET /api/players/123456789012345678
   * GET /api/players/550e8400-e29b-41d4-a716-446655440000
   */
  static async getPlayer(req: Request, res: Response): Promise<void> {
    try {
      // Validate path parameters
      const { id } = GetPlayerParamsSchema.parse(req.params);

      const idType = getIdType(id);
      if (idType === "invalid") {
        throw new BadRequestError(
          "Invalid player ID. Must be a Discord ID or Minecraft UUID.",
        );
      }

      const identifier =
        idType === "discord" ? { discordId: id } : { minecraftUuid: id };

      const player = await Q.player.find(identifier);

      if (!player) {
        throw new NotFoundError(`Player with ID ${id} not found`);
      }

      const response: GetPlayerResponse = {
        success: true,
        data: player as any,
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
   * GET /api/players
   *
   * Retrieves a list of players with filtering and pagination
   *
   * Query Parameters:
   * Filtering:
   * - discordId: Filter by Discord ID
   * - minecraftUuid: Filter by Minecraft UUID
   * - minecraftUsername: Filter by Minecraft username (case-insensitive partial match)
   * - isActive: Filter by active status (true/false)
   *
   * Pagination:
   * - page: Page number (0-indexed, default: 0)
   * - limit: Results per page (1-100, default: 20)
   *
   * Sorting:
   * - sortBy: Field to sort by (createdAt, minecraftUsername, updatedAt)
   * - sortOrder: Sort direction (ASC/DESC, default: DESC)
   *
   * @example
   * GET /api/players?limit=10&page=0
   * GET /api/players?minecraftUsername=Steve
   * GET /api/players?isActive=true&sortBy=minecraftUsername&sortOrder=ASC
   */
  static async getPlayers(req: Request, res: Response): Promise<void> {
    try {
      // Validate and transform query parameters
      const query = GetPlayersQuerySchema.parse(req.query);

      // Build filters
      const filters: any = {};

      if (query.discordId) {
        filters.discordId = query.discordId;
      }

      if (query.minecraftUuid) {
        filters.minecraftUuid = query.minecraftUuid;
      }

      if (query.minecraftUsername) {
        filters.minecraftUsername = {
          $ilike: `%${query.minecraftUsername}%`,
        };
      }

      if (query.isActive !== undefined) {
        filters.isActive = query.isActive; // Already a boolean!
      }

      // Fetch players
      const players = await Q.player.findAll(filters, {
        orderBy: query.sortBy,
        orderDirection: query.sortOrder,
        limit: query.limit,
        offset: query.page * query.limit,
      });

      const total = await Q.player.count(filters);

      const response: GetPlayersResponse = {
        success: true,
        data: {
          players: players as any,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
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
      logger.error("Failed to fetch players:", error);
      throw new InternalServerError("Failed to fetch players");
    }
  }

  /**
   * GET /api/players/count
   *
   * Retrieves the count of registered players from the database
   *
   * @example
   * GET /api/players/count
   * GET /api/players/count?online=true
   * GET /api/players/count?currentServerId=1
   * GET /api/players/count?createdAfter=2024-01-01T00:00:00Z
   */
  static async getCount(req: Request, res: Response): Promise<void> {
    try {
      // Validate and transform query parameters
      const query = GetPlayersCountQuerySchema.parse(req.query);

      // Build filters
      const filters: any = {};

      // Filter by online status (already a boolean!)
      if (query.online !== undefined) {
        filters.online = query.online;
      }

      // Filter by current server (already a number!)
      if (query.currentServerId !== undefined) {
        filters.currentServerId = query.currentServerId;
      }

      // Filter by creation date range
      if (query.createdAfter) {
        filters.createdAt = { $gte: new Date(query.createdAfter) };
      }

      if (query.createdBefore) {
        filters.createdAt = {
          ...filters.createdAt,
          $lte: new Date(query.createdBefore),
        };
      }

      // Filter by last seen date
      if (query.lastSeenAfter) {
        filters.lastSeen = { $gte: new Date(query.lastSeenAfter) };
      }

      const count = await Q.player.count(filters);

      const response: GetPlayersCountResponse = {
        success: true,
        data: {
          count,
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
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.error("Database error while fetching player count:", error);
      throw new InternalServerError("Failed to fetch player count");
    }
  }
}
