import { player } from "@/db";
import type { Player } from "@createrington/shared/db";

export type PlayerIdentifier =
  | { minecraftUuid: string }
  | { minecraftUsername: string }
  | { discordId: string }
  | Player
  | string;

/**
 * Base repository with shared player utilities
 *
 * Provides:
 * - Player UUID resolution
 * - Common helper methods
 */
export abstract class BasePlayerRepository {
  /**
   * Resolves various player identifier formats to a Minecraft UUID
   *
   * @param identifier - Player identifier in various formats
   * @returns Promise resolving to Minecraft UUID
   */
  protected async resolvePlayerUuid(
    identifier: PlayerIdentifier,
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const result = await player.get(identifier);
    return result.minecraftUuid;
  }

  /**
   * Gets a player record from any identifier
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to Player record
   */
  protected async getPlayer(identifier: PlayerIdentifier): Promise<Player> {
    if (typeof identifier === "object" && "minecraftUsername" in identifier) {
      return identifier as Player;
    }
    const uuid = await this.resolvePlayerUuid(identifier);
    return await player.get({ minecraftUuid: uuid });
  }
}
