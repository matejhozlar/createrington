import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { Ticket } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Repository for player ticket management
 *
 * Handles:
 * - Ticket retrieval
 * - Ticket counting
 * - Ticket pagination
 */
export class PlayerTicketRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Gets all tickets for a player
   *
   * @param identifier - Player identifier
   * @param limit - Max entries to get
   * @param offset - The offset for pagination
   * @returns Promise to an array of tickets
   */
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

  /**
   * Count all tickets for a player
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to a number of tickets
   */
  async count(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await Q.ticket.count({ creatorDiscordId: player.discordId });
  }
}
