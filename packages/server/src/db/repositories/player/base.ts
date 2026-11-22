import { Q } from "@/db/pool";
import type { Player } from "@createrington/shared/db";
import type { DatabaseQueries } from "@/generated/db";

export type PlayerIdentifier =
  | { minecraftUuid: string }
  | { minecraftUsername: string }
  | { discordId: string }
  | Player
  | string;

/**
 * Abstract base for player-scoped repositories. Provides shared identifier
 * resolution (resolvePlayerUuid) so subclasses can accept any
 * PlayerIdentifier shape without each duplicating the lookup.
 */
export abstract class BasePlayerRepository {
  protected async resolvePlayerUuid(
    identifier: PlayerIdentifier,
    tx?: DatabaseQueries,
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const player = await (tx ?? Q).player.get(identifier);
    return player.minecraftUuid;
  }
}
