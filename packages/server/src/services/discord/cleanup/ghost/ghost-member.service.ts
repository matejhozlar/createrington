import { Q } from "@/db";
import { getServiceSync, Services } from "@/services";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";

export interface GhostMember {
  discordId: string;
  minecraftUuid: string;
  minecraftUsername: string;
  playerCreatedAt: Date;
  playerLastSeen: Date;
}

export interface GhostListResult {
  items: GhostMember[];
  total: number;
}

export interface GhostVerifyResult {
  /** False when the user has rejoined Discord since the last refresh. */
  stillGone: boolean;
  /** True when this call evicted the user from the cache because they're back. */
  evicted: boolean;
  /** The cached ghost info, present iff stillGone is true. */
  ghost: GhostMember | null;
}

export interface GhostRefreshResult {
  count: number;
  refreshedAt: Date;
}

/**
 * In-memory cache of registered players (player.discord_id set) who are not
 * currently members of the Discord guild. Admins are excluded by design,
 * mirroring the inactivity sweep policy.
 *
 * The cache is only ever populated by an explicit refresh() call from the
 * admin tool. No background timer, no persistence: an app restart clears
 * it and the admin re-clicks "Refresh" to repopulate.
 */
export class GhostMemberService {
  private cache: Map<string, GhostMember> = new Map();
  private lastRefreshedAt: Date | null = null;
  private refreshInFlight: Promise<void> | null = null;

  getLastRefreshedAt(): Date | null {
    return this.lastRefreshedAt;
  }

  /**
   * Rebuild the cache from the current guild member list and player table.
   * Concurrent callers share the same in-flight refresh.
   */
  async refresh(): Promise<GhostRefreshResult> {
    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return {
        count: this.cache.size,
        refreshedAt: this.lastRefreshedAt ?? new Date(),
      };
    }

    this.refreshInFlight = this.doRefresh();
    try {
      await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }

    return {
      count: this.cache.size,
      refreshedAt: this.lastRefreshedAt ?? new Date(),
    };
  }

  private async doRefresh(): Promise<void> {
    const guild = this.getGuild();

    await guild.members.fetch();
    const guildMemberIds = new Set(guild.members.cache.keys());

    const [players, admins] = await Promise.all([
      Q.player.findAll({}),
      Q.admin.findAll({}),
    ]);
    const adminIds = new Set(admins.map((a) => a.discordId));

    const next = new Map<string, GhostMember>();
    for (const player of players) {
      if (adminIds.has(player.discordId)) continue;
      if (guildMemberIds.has(player.discordId)) continue;

      next.set(player.discordId, {
        discordId: player.discordId,
        minecraftUuid: player.minecraftUuid,
        minecraftUsername: player.minecraftUsername,
        playerCreatedAt: player.createdAt,
        playerLastSeen: player.lastSeen,
      });
    }

    this.cache = next;
    this.lastRefreshedAt = new Date();

    logger.info(`GhostMemberService refresh: ${this.cache.size} ghost(s)`);
  }

  /**
   * Paginated read from the in-memory cache. Sorted by minecraft username
   * (case-insensitive) for stable display order.
   */
  list(params: {
    page: number;
    limit: number;
    search?: string;
  }): GhostListResult {
    const search = params.search?.trim().toLowerCase();
    const all = Array.from(this.cache.values()).filter((g) => {
      if (!search) return true;
      return g.minecraftUsername.toLowerCase().includes(search);
    });

    all.sort((a, b) =>
      a.minecraftUsername
        .toLowerCase()
        .localeCompare(b.minecraftUsername.toLowerCase()),
    );

    const total = all.length;
    const start = params.page * params.limit;
    const items = all.slice(start, start + params.limit);

    return { items, total };
  }

  /**
   * Re-check a single user against Discord. If the user has rejoined,
   * remove them from the cache and report `stillGone: false`. Used by the
   * remove dialog to confirm the action is still valid at the moment the
   * admin opens the modal.
   */
  async verify(discordId: string): Promise<GhostVerifyResult> {
    const guild = this.getGuild();

    const member = await guild.members
      .fetch({ user: discordId, force: true })
      .catch(() => null);

    if (member) {
      const evicted = this.cache.delete(discordId);
      return { stillGone: false, evicted, ghost: null };
    }

    const ghost = this.cache.get(discordId) ?? null;
    return { stillGone: true, evicted: false, ghost };
  }

  /**
   * Run the removal sequence for a ghost: re-verify, RCON whitelist remove
   * on all servers, delete player record, evict from cache. Returns the
   * info needed by the caller to write an admin_log_action entry.
   *
   * Throws if the user is no longer a ghost (rejoined Discord between
   * dialog open and confirm click), or if the player record is missing.
   */
  async remove(discordId: string): Promise<{
    minecraftUuid: string;
    minecraftUsername: string;
  }> {
    const verification = await this.verify(discordId);
    if (!verification.stillGone) {
      throw new Error(
        "User has rejoined Discord since the cache was last refreshed",
      );
    }

    const ghost = verification.ghost;
    if (!ghost) {
      throw new Error("Ghost not found in cache");
    }

    try {
      await minecraftRcon.whitelistAll(
        WhitelistAction.REMOVE,
        ghost.minecraftUsername,
      );
    } catch (error) {
      logger.error(
        `Failed to remove ${ghost.minecraftUsername} from whitelist:`,
        error,
      );
    }

    await Q.player.delete({ minecraftUuid: ghost.minecraftUuid });

    this.cache.delete(discordId);

    logger.info(
      `Removed ghost member ${ghost.minecraftUsername} (discordId ${discordId})`,
    );

    return {
      minecraftUuid: ghost.minecraftUuid,
      minecraftUsername: ghost.minecraftUsername,
    };
  }

  private getGuild() {
    const mainBot = getServiceSync(Services.DISCORD_MAIN_BOT);
    const guild = mainBot.guilds.cache.first();
    if (!guild) {
      throw new Error("Main bot is not connected to a guild");
    }
    return guild;
  }
}
