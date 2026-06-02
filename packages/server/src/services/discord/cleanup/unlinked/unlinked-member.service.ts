import { Q } from "@/db";
import { getServiceSync, Services } from "@/services";
import { Discord } from "@/discord/constants";

export interface UnlinkedMember {
  discordId: string;
  username: string;
  displayName: string;
  joinedAt: Date | null;
}

export interface UnlinkedListResult {
  items: UnlinkedMember[];
  total: number;
}

export interface UnlinkedRefreshResult {
  count: number;
  refreshedAt: Date;
}

/**
 * In-memory cache of Discord guild members who have finished onboarding (no
 * UNVERIFIED role) yet have no matching player record. Bots and members still
 * mid-registration are excluded so the list only surfaces genuine mismatches.
 *
 * This is the inverse of GhostMemberService: ghosts are in the database but
 * gone from Discord, these are in Discord but absent from the database. Unlike
 * ghosts there is no removal action: there is no player record to delete, so
 * the tool is read-only.
 *
 * The cache is only ever populated by an explicit refresh() call from the
 * admin tool. No background timer, no persistence: an app restart clears it
 * and the admin re-clicks "Refresh" to repopulate.
 */
export class UnlinkedMemberService {
  private cache: Map<string, UnlinkedMember> = new Map();
  private lastRefreshedAt: Date | null = null;
  private refreshInFlight: Promise<void> | null = null;

  /** Timestamp of the last completed refresh, or null if never refreshed. */
  getLastRefreshedAt(): Date | null {
    return this.lastRefreshedAt;
  }

  /**
   * Rebuild the cache from the current guild member list and player table.
   * Concurrent callers share the same in-flight refresh.
   */
  async refresh(): Promise<UnlinkedRefreshResult> {
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

    const players = await Q.player.findAll({});
    const playerDiscordIds = new Set(players.map((p) => p.discordId));

    const next = new Map<string, UnlinkedMember>();
    for (const member of guild.members.cache.values()) {
      if (member.user.bot) continue;
      if (member.roles.cache.has(Discord.Roles.UNVERIFIED)) continue;
      if (playerDiscordIds.has(member.id)) continue;

      next.set(member.id, {
        discordId: member.id,
        username: member.user.username,
        displayName: member.displayName,
        joinedAt: member.joinedAt,
      });
    }

    this.cache = next;
    this.lastRefreshedAt = new Date();

    logger.info(
      `UnlinkedMemberService refresh: ${this.cache.size} unlinked member(s)`,
    );
  }

  /**
   * Paginated read from the in-memory cache. Sorted by display name
   * (case-insensitive) for stable display order.
   */
  list(params: {
    page: number;
    limit: number;
    search?: string;
  }): UnlinkedListResult {
    const search = params.search?.trim().toLowerCase();
    const all = Array.from(this.cache.values()).filter((m) => {
      if (!search) return true;
      return (
        m.displayName.toLowerCase().includes(search) ||
        m.username.toLowerCase().includes(search)
      );
    });

    all.sort((a, b) =>
      a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()),
    );

    const total = all.length;
    const start = params.page * params.limit;
    const items = all.slice(start, start + params.limit);

    return { items, total };
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
