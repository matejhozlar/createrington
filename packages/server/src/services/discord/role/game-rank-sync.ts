import config from "@/config";
import { Q } from "@/db";
import { FtbRanksClient } from "@/services/mc-server/ftb-ranks";
import type { TopBalanceRoleRule, TopPlaytimeRoleRule } from "./types";

export type GameRankRule = TopPlaytimeRoleRule | TopBalanceRoleRule;

export function isGameRankSyncAllowed(): boolean {
  return config.envMode.isProd && !config.envMode.isDevDeployment;
}

/**
 * Mirrors the competitive top-1 Discord roles (top playtime, top balance) into
 * FTB Ranks on the Rails 'n Sails server over RCON, right after the daily
 * role check computes them. Former holders (Discord members still carrying
 * the role) lose the in-game rank first, then the current #1 receives it. The
 * grant is repeated on every run because the mod treats it as a no-op when
 * already held, so a day the game server was unreachable self-heals. Runs
 * only on the production deployment: local dev and dev.createrington.com
 * share the production RCON target. Every failure is logged and swallowed so
 * an unreachable game server never blocks the Discord side.
 */
export class GameRankSync {
  constructor(
    private readonly ranks: FtbRanksClient = new FtbRanksClient(),
    private readonly serverId: number = config.servers.rails.id,
    private readonly isAllowed: () => boolean = isGameRankSyncAllowed,
  ) {}

  /** Grants the rule's in-game rank to `holderUsername` and revokes it from the former holders, given as Discord ids. */
  async sync(
    rule: GameRankRule,
    holderUsername: string,
    formerHolderDiscordIds: string[],
  ): Promise<void> {
    const rankId = rule.gameRankId;
    if (!rankId) return;

    if (!this.isAllowed()) {
      logger.debug(
        `Skipping in-game rank sync for "${rule.label}" outside production`,
      );
      return;
    }

    for (const discordId of formerHolderDiscordIds) {
      await this.revoke(rankId, rule.label, discordId);
    }

    await this.grant(rankId, rule.label, holderUsername);
  }

  private async revoke(
    rankId: string,
    label: string,
    discordId: string,
  ): Promise<void> {
    try {
      const player = await Q.player.find({ discordId });
      if (!player) {
        logger.warn(
          `Cannot revoke in-game rank "${label}": no player registered for Discord id ${discordId}`,
        );
        return;
      }

      const revoked = await this.ranks.remove(
        this.serverId,
        player.minecraftUsername,
        rankId,
      );
      if (revoked) {
        logger.info(
          `Revoked in-game rank "${label}" from ${player.minecraftUsername}`,
        );
      }
    } catch (error) {
      logger.error(
        `Failed to revoke in-game rank "${label}" from Discord id ${discordId}:`,
        error,
      );
    }
  }

  private async grant(
    rankId: string,
    label: string,
    username: string,
  ): Promise<void> {
    try {
      const granted = await this.ranks.add(this.serverId, username, rankId);
      if (granted) {
        logger.info(`Granted in-game rank "${label}" to ${username}`);
      }
    } catch (error) {
      logger.error(
        `Failed to grant in-game rank "${label}" to ${username}:`,
        error,
      );
    }
  }
}
