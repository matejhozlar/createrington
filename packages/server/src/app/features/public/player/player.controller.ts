import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "@/app/middleware";
import { getIdType } from "@/app/utils/helpers";
import { Q } from "@/db";
import type {
  GetPlayerResponse,
  GetPlayersCountResponse,
  GetPlayersResponse,
} from "@createrington/shared/api";
import type { Request, Response } from "express";

/**
 * Player controller
 *
 * Handles player data retrieval with filtering and querying
 */
export class PlayerController {
  /**
   * GET /api/players/:id
   *
   * Retrieves a single player by Discord ID o Minecraft UUID
   *
   * Path Parameters:
   * - id: Discord ID (17-20 digits) or Minecraft UUID (UUID format)
   *
   * @example
   * GET /api/players/123456789012345678
   * GET /api/players/550e8400-e29b-41d4-a716-446655440000
   */
  static async getPlayer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (Array.isArray(id)) {
      throw new BadRequestError("Invalid player ID");
    }

    const idType = getIdType(id);
    if (idType === "invalid") {
      throw new BadRequestError(
        "Invalid player ID. Must be a Discord ID or Minecraft UUID.",
      );
    }

    try {
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
   * - discord_id: Filter by Discord ID
   * - minecraft_uuid: Filter by Minecraft UUID
   * - minecraft_username: Filter by Minecraft username (case-insensitive partial match)
   * - is_active: Filter by active status (true/false)
   *
   * Pagination:
   * - page: Page number (0-indexed, default: 0)
   * - limit: Results per page (1-100, default: 20)
   *
   * Sorting:
   * - sort_by: Field to sort by (createdAt, minecraftUsername, updatedAt)
   * - sort_order: Sort direction (asc/desc, default: desc)
   *
   * @example
   * GET /api/players?limit=10&page=0
   * GET /api/players?minecraft_username=Steve
   * GET /api/players?is_active=true&sort_by=minecraftUsername&sort_order=asc
   */
  static async getPlayers(req: Request, res: Response): Promise<void> {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string)),
    );

    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder =
      (req.query.sortOrder as string)?.toLowerCase() === "ASC" ? "ASC" : "DESC";

    const filters: any = {};

    if (req.query.discordId) {
      filters.discordId = req.query.discordId as string;
    }

    if (req.query.minecraftUuid) {
      filters.minecraftUuid = req.query.minecraftUuid as string;
    }

    if (req.query.minecraftUsername) {
      filters.minecraftUsername = {
        $ilike: `%${req.query.minecraftUsername}%`,
      };
    }

    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === "true";
    }

    const validSortFields = ["createdAt", "minecraftUsername", "updatedAt"];
    const orderBy = validSortFields.includes(sortBy)
      ? (sortBy as any)
      : "createdAt";

    try {
      const players = await Q.player.findAll(filters, {
        orderBy,
        orderDirection: sortOrder,
        limit,
        offset: page * limit,
      });

      const total = await Q.player.count(filters);

      const response: GetPlayersResponse = {
        success: true,
        data: {
          players: players as any,
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
      const filters: any = {};

      // Filter by online status
      if (req.query.online !== undefined) {
        filters.online = req.query.online === "true";
      }

      // Filter by current server
      if (req.query.currentServerId) {
        const serverId = parseInt(req.query.currentServerId as string);
        if (isNaN(serverId)) {
          throw new BadRequestError("Invalid server ID");
        }
        filters.currentServerId = serverId;
      }

      // Filter by creation date range
      if (req.query.createdAfter) {
        const date = new Date(req.query.createdAfter as string);
        if (isNaN(date.getTime())) {
          throw new BadRequestError("Invalid createdAfter date format");
        }
        filters.createdAt = { $gte: date };
      }

      if (req.query.createdBefore) {
        const date = new Date(req.query.createdBefore as string);
        if (isNaN(date.getTime())) {
          throw new BadRequestError("Invalid createdBefore date format");
        }
        filters.createdAt = {
          ...filters.createdAt,
          $lte: date,
        };
      }

      // Filter by last seen date
      if (req.query.lastSeenAfter) {
        const date = new Date(req.query.lastSeenAfter as string);
        if (isNaN(date.getTime())) {
          throw new BadRequestError("Invalid lastSeenAfter date format");
        }
        filters.lastSeen = { $gte: date };
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
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.error("Database error while fetching player count:", error);
      throw new InternalServerError("Failed to fetch player count");
    }
  }
}
