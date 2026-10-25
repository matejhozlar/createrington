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

  /** One page of the player's sessions, newest first, with the total count. */
  async getHistoryPage(
    identifier: PlayerIdentifier,
    serverId: number | undefined,
    limit: number,
    offset: number,
  ): Promise<{ sessions: PlayerSession[]; total: number }> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const filters = {
      playerMinecraftUuid: uuid,
      ...(serverId && { serverId }),
    };

    const [sessions, total] = await Promise.all([
      Q.player.session.findAll(filters, {
        limit,
        offset,
        orderBy: DatabaseTable.PLAYER_SESSION.CAMEL_FIELDS.SESSION_START,
        orderDirection: "desc",
      }),
      Q.player.session.count(filters),
    ]);
    return { sessions, total };
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
