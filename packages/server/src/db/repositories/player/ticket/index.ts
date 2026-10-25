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

  /** One page of the player's tickets, newest first, with the total count. */
  async getPage(
    identifier: PlayerIdentifier,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });
    const filters = { creatorDiscordId: player.discordId };

    const [tickets, total] = await Promise.all([
      Q.ticket.findAll(filters, {
        limit,
        offset,
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      }),
      Q.ticket.count(filters),
    ]);
    return { tickets, total };
  }

  /** Total ticket count created by the player. */
  async count(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await Q.ticket.count({ creatorDiscordId: player.discordId });
  }
}
