import config from "@/config";
import { Q } from "@/db";
import {
  FtbRanksClient,
  FtbRanksCommandError,
} from "@/services/mc-server/ftb-ranks";
import type { TopRoleRule } from "./types";

export function isGameRankSyncAllowed(): boolean {
  return config.envMode.isProd && !config.envMode.isDevDeployment;
}

function isNothingToRevoke(error: unknown): boolean {
  return (
    error instanceof FtbRanksCommandError &&
    (error.reason === "unknown_rank" || error.reason === "unknown_player")
  );
}

/**
 * Mirrors the competitive top-1 Discord roles (top playtime, top balance) into
 * FTB Ranks on the Rails 'n Sails server over RCON, driven by the daily role
 * check in RoleManagementService. `revoke` runs before the Discord role is
 * stripped from former holders and reports which of them still carry the
 * in-game rank, so the caller keeps their Discord role as the retry ledger
 * for the next pass. `grant` runs once the current #1 holds the Discord role
 * and is repeated on every pass: the mod treats a repeated grant as a no-op,
 * so a day the game server was unreachable self-heals. Runs only on the
 * production deployment (local dev and dev.createrington.com share the
 * production RCON target). RCON failures are logged and never thrown; a rank
 * that is not declared on the server yet is logged as a warning.
 */
export class GameRankSyncService {
  constructor(
    private readonly ranks: FtbRanksClient = new FtbRanksClient(),
    private readonly serverId: number = config.servers.rails.id,
    private readonly isAllowed: () => boolean = isGameRankSyncAllowed,
  ) {}

  /** Revokes the rule's in-game rank from each former holder (Discord ids) and resolves the ids whose revoke did not go through. */
  async revoke(
    rule: TopRoleRule,
    formerHolderDiscordIds: string[],
  ): Promise<Set<string>> {
    const pending = new Set<string>();

    if (formerHolderDiscordIds.length === 0) return pending;

    if (!this.isAllowed()) {
      logger.debug(
        `Skipping in-game rank revoke for "${rule.label}" outside production`,
      );
      return pending;
    }

    for (const discordId of formerHolderDiscordIds) {
      if (!(await this.revokeFrom(rule, discordId))) {
        pending.add(discordId);
      }
    }

    return pending;
  }

  /** Grants the rule's in-game rank to the current holder. Safe to repeat. */
  async grant(rule: TopRoleRule, username: string): Promise<void> {
    if (!this.isAllowed()) {
      logger.debug(
        `Skipping in-game rank grant for "${rule.label}" outside production`,
      );
      return;
    }

    try {
      const granted = await this.ranks.add(
        this.serverId,
        username,
        rule.gameRankId,
      );
      if (granted) {
        logger.info(`Granted in-game rank "${rule.label}" to ${username}`);
      }
    } catch (error) {
      this.logFailure(
        `grant in-game rank "${rule.label}" to ${username}`,
        error,
      );
    }
  }

  private async revokeFrom(
    rule: TopRoleRule,
    discordId: string,
  ): Promise<boolean> {
    try {
      const player = await Q.player.find({ discordId });
      if (!player) {
        logger.warn(
          `Cannot revoke in-game rank "${rule.label}": no player registered for Discord id ${discordId}`,
        );
        return true;
      }

      const revoked = await this.ranks.remove(
        this.serverId,
        player.minecraftUsername,
        rule.gameRankId,
      );
      if (revoked) {
        logger.info(
          `Revoked in-game rank "${rule.label}" from ${player.minecraftUsername}`,
        );
      }
      return true;
    } catch (error) {
      this.logFailure(
        `revoke in-game rank "${rule.label}" from Discord id ${discordId}`,
        error,
      );
      return isNothingToRevoke(error);
    }
  }

  private logFailure(action: string, error: unknown): void {
    if (
      error instanceof FtbRanksCommandError &&
      error.reason === "unknown_rank"
    ) {
      logger.warn(
        `Cannot ${action}: ${error.message} (declare it in ranks.snbt and run /ftbranks reload)`,
      );
      return;
    }
    logger.error(`Failed to ${action}:`, error);
  }
}
