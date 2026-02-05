import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { PlayerSession } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Repository for player session history management
 *
 * Handles:
 * - Session history retrieval
 * - Session counting
 * - Session pagination
 */
export class PlayerSessionRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Gets player's session history with pagination
   *
   * @param identifier - Player identifier
   * @param serverId - Optional server filter
   * @param limit - Number of sessions to return
   * @param offset - Number of sessions to skip (for pagination)
   * @returns Promise resolving to array of player sessions
   */
  async getHistory(
    identifier: PlayerIdentifier,
    serverId?: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PlayerSession[]> {
    const uuid = await this.resolvePlayerUuid(identifier);

    return await Q.player.session.findAll(
      {
        playerMinecraftUuid: uuid,
        ...(serverId && { serverId }),
      },
      {
        limit,
        offset,
        orderBy: DatabaseTable.PLAYER_SESSION.CAMEL_FIELDS.SESSION_START,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Counts total sessions for a player
   *
   * @param identifier - Player identifier
   * @param serverId - Optional server filter
   * @returns Promise resolving to total session count
   */
  async count(
    identifier: PlayerIdentifier,
    serverId?: number,
  ): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);

    return await Q.player.session.count({
      playerMinecraftUuid: uuid,
      ...(serverId && { serverId }),
    });
  }
}
