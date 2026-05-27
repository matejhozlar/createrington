import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { PlayerSession } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Read access over player_session scoped to a single player. Session writes
 * (start/end, aggregation) live in PlaytimeRepository; this class is the
 * read surface used by admin views and player profiles.
 */
export class PlayerSessionRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /** Paginated session history for a player, newest first; optional server filter. */
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

  /** Total session count for a player, optionally scoped to a server. */
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
