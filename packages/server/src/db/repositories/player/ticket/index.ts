import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { Ticket } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Player-scoped read view over the ticket table. Resolves the player from a
 * PlayerIdentifier first so callers can pass UUID/username/Discord ID
 * uniformly. Ticket lifecycle writes live in TicketRepository.
 */
export class PlayerTicketRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /** Paginated tickets created by the player, newest first. */
  async getAll(
    identifier: PlayerIdentifier,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Ticket[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await Q.ticket.findAll(
      { creatorDiscordId: player.discordId },
      {
        limit,
        offset,
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /** Total ticket count created by the player. */
  async count(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await Q.ticket.count({ creatorDiscordId: player.discordId });
  }
}
