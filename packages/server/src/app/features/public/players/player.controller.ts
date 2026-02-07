import { buildResponse, NotFoundError, TypedResponse } from "@/app/middleware";
import { idToObject } from "@/app/utils/helpers";
import { Q } from "@/db";
import type {
  GetPlayersResponse,
  GetPlayerResponse,
  GetPlayersCountResponse,
} from "@createrington/shared/api/public/players";
import type { Request, Response } from "express";

/**
 * Player Controller
 *
 * Handles player data retrieval with filtering and querying
 */
export class PlayerController {
  /**
   * GET /api/players/:id
   *
   * Retrieves a single player by Discord ID, Minecraft UUID, or username
   *
   * @example
   * GET /api/players/123456789012345678
   * GET /api/players/550e8400-e29b-41d4-a716-446655440000
   * GET /api/players/Notch
   */
  static async getPlayer(req: Request, res: Response): Promise<void> {
    const { id } = req.validatedParams;

    const identifier = idToObject(id);
    if (!identifier) {
      throw new NotFoundError(
        "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
      );
    }

    const player = await Q.player.find(identifier);

    if (!player) {
      throw new NotFoundError(`Player with ID ${id} not found`);
    }

    const response = buildResponse<GetPlayerResponse>({
      success: true,
      data: player,
    });

    return TypedResponse.ok<GetPlayerResponse>(res, response);
  }

  /**
   * GET /api/players
   *
   * Retrieves a list of players with filtering and pagination
   *
   * @example
   * GET /api/players?limit=10&page=0
   * GET /api/players?minecraftUsername=Steve
   * GET /api/players?isActive=true&orderBy=minecraftUsername&orderDirection=asc
   */
  static async getPlayers(req: Request, res: Response): Promise<void> {
    const query = req.validatedQuery;

    const filters: any = {};

    if (query.discordId) filters.discordId = query.discordId;
    if (query.minecraftUuid) filters.minecraftUuid = query.minecraftUuid;
    if (query.minecraftUsername) {
      filters.minecraftUsername = {
        $ilike: `%${query.minecraftUsername}%`,
      };
    }
    if (query.isActive !== undefined) filters.isActive = query.isActive;

    const { orderBy, orderDirection, limit, page } = query;

    const [players, total] = await Promise.all([
      Q.player.findAll(filters, {
        orderBy,
        orderDirection,
        limit,
        offset: page * limit,
      }),
      Q.player.count(filters),
    ]);

    const response = buildResponse<GetPlayersResponse>({
      success: true,
      data: {
        players,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });

    return TypedResponse.ok<GetPlayersResponse>(res, response);
  }

  /**
   * GET /api/players/count
   *
   * Retrieves the count of registered players
   *
   * @example
   * GET /api/players/count
   * GET /api/players/count?online=true
   * GET /api/players/count?currentServerId=1
   */
  static async getCount(req: Request, res: Response): Promise<void> {
    const query = req.validatedQuery;

    const filters: any = {};

    if (query.online !== undefined) filters.online = query.online;
    if (query.currentServerId !== undefined) {
      filters.currentServerId = query.currentServerId;
    }
    if (query.createdAfter) {
      filters.createdAt = { $gte: new Date(query.createdAfter) };
    }
    if (query.createdBefore) {
      filters.createdAt = {
        ...filters.createdAt,
        $lte: new Date(query.createdBefore),
      };
    }
    if (query.lastSeenAfter) {
      filters.lastSeen = { $gte: new Date(query.lastSeenAfter) };
    }

    const count = await Q.player.count(filters);

    const response = buildResponse<GetPlayersCountResponse>({
      success: true,
      data: { count },
    });

    return TypedResponse.ok<GetPlayersCountResponse>(res, response);
  }
}
