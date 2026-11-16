import { Q } from "@/db";
import type { Player } from "@createrington/shared/db";

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
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const result = await Q.player.get(identifier);
    return result.minecraftUuid;
  }
}
