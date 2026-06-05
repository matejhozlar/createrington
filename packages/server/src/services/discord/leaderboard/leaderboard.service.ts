import { Q } from "@/db";
import { getLeaderboardConfig } from "./config";
import { type LeaderboardRefreshResult, LeaderboardType } from "./types";
import { Discord } from "@/discord/constants";
import { type Client } from "discord.js";
import { LeaderboardComponentPresets } from "@/discord/components/presets/leaderboard";

// Components V2 caps a message at 40 total components; the V2 layout (banner,
// per-player head sections, separators, footer) fits 8 ranked entries.
const LEADERBOARD_LIMIT = 8;

const MESSAGE_NOT_FOUND_PATTERNS = [
  "Unknown Message",
  "Unknown Channel",
  "Message not found",
  "Channel not found",
];

function isMessageNotFoundError(error?: string): boolean {
  if (!error) return false;
  return MESSAGE_NOT_FOUND_PATTERNS.some((p) => error.includes(p));
}

/**
 * Owns the persistent leaderboard messages posted to Discord. On `initialize`
 * it does one immediate refresh of every `LeaderboardType` and then runs an
 * hourly refresh interval. Each leaderboard's message ID is stored in
 * `leaderboard_message` so refreshes edit in place; if Discord reports the
 * stored message or channel as gone, the stale row is deleted and the next
 * `createOrUpdate` posts a fresh one. Manual refreshes (`isManual=true`) are
 * cooldown-tracked separately via `lastManualRefresh` and rate-limited to one
 * per hour per leaderboard; automatic refreshes ignore the cooldown.
 */
export class LeaderboardService {
  private refreshInterval?: NodeJS.Timeout;
  private readonly REFRESH_INTERVAL = 60 * 60 * 1000;
  constructor(private readonly bot: Client) {}

  /** Runs an immediate `refreshAll` and then starts the hourly auto-refresh interval. */
  async initialize(): Promise<void> {
    logger.info("Initializing LeaderboardService...");

    logger.info("Running initial leaderboard refresh");
    await this.refreshAll();

    this.refreshInterval = setInterval(async () => {
      logger.info("Running scheduled leaderboard refresh");
      await this.refreshAll();
    }, this.REFRESH_INTERVAL);

    logger.info("LeaderboardService initialized");
  }

  /** Stops the auto-refresh interval; the last-posted Discord messages stay in place. */
  async shutdown(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      logger.info("LeaderboardService refresh scheduler stopped");
    }
  }

  /**
   * Edits the existing leaderboard message for `type`, or posts a fresh one
   * when no record exists or the stored message has been deleted (in which
   * case the stale row is removed first). Throws on any other edit/send
   * failure.
   */
  async createOrUpdate(
    type: LeaderboardType,
  ): Promise<{ messageId: string; channelId: string }> {
    const config = getLeaderboardConfig(type);

    const entries = await config.fetchData(
      config.serverId ?? 0,
      LEADERBOARD_LIMIT,
    );

    const { components, flags } = LeaderboardComponentPresets.display(
      config,
      entries,
      new Date(),
    );

    const existing = await Q.leaderboard.message.find({
      leaderboardType: type,
    });

    if (existing) {
      const editResult = await Discord.Messages.edit({
        channelId: existing.channelId,
        messageId: existing.messageId,
        embeds: null,
        components,
        flags,
      });

      if (editResult.success) {
        await Q.leaderboard.message.update(
          { id: existing.id },
          { lastRefreshed: new Date() },
        );

        logger.info(
          `Updated ${type} leaderboard message ${existing.messageId}`,
        );

        return {
          messageId: existing.messageId,
          channelId: existing.channelId,
        };
      }

      if (isMessageNotFoundError(editResult.error)) {
        logger.warn(
          `Leaderboard message ${existing.messageId} no longer exists, removing stale record`,
        );
        await Q.leaderboard.message.delete({ id: existing.id });
      } else {
        throw new Error(
          `Failed to update ${type} leaderboard: ${editResult.error}`,
        );
      }
    }

    const result = await Discord.Messages.send({
      channelId: config.channelId,
      components,
      flags,
    });

    if (!result.success || !result.messageId) {
      throw new Error(`Failed to create ${type} leaderboard message`);
    }

    await Q.leaderboard.message.create({
      leaderboardType: type,
      channelId: config.channelId,
      messageId: result.messageId,
    });

    logger.info(`Created ${type} leaderboard message ${result.messageId}`);

    return {
      messageId: result.messageId,
      channelId: config.channelId,
    };
  }

  /**
   * Refetches data and edits the existing leaderboard message. Pass
   * `isManual=true` to also stamp `lastManualRefresh` (drives the 1h cooldown
   * in `canRefresh`); automatic refreshes only update `lastRefreshed`.
   * Returns a result instead of throwing; the stale-message row is deleted on
   * "unknown message" errors.
   */
  async refresh(
    type: LeaderboardType,
    isManual: boolean = false,
  ): Promise<LeaderboardRefreshResult> {
    try {
      const config = getLeaderboardConfig(type);

      const entries = await config.fetchData(
        config.serverId ?? 0,
        LEADERBOARD_LIMIT,
      );

      const existing = await Q.leaderboard.message.find({
        leaderboardType: type,
      });

      if (!existing) {
        logger.warn(
          `No leaderboard message found for type: ${type}, skipping refresh`,
        );
        return {
          success: false,
          type,
          entries: [],
          error: `No leaderboard message found for type: ${type}`,
        };
      }

      const { components, flags } = LeaderboardComponentPresets.display(
        config,
        entries,
        new Date(),
      );

      const editResult = await Discord.Messages.edit({
        channelId: existing.channelId,
        messageId: existing.messageId,
        embeds: null,
        components,
        flags,
      });

      if (!editResult.success) {
        if (isMessageNotFoundError(editResult.error)) {
          logger.warn(
            `Leaderboard message ${existing.messageId} no longer exists, removing stale record`,
          );
          await Q.leaderboard.message.delete({ id: existing.id });
        }

        return {
          success: false,
          type,
          entries: [],
          error: editResult.error ?? "Failed to edit leaderboard message",
        };
      }

      const updates: {
        lastRefreshed: Date;
        lastManualRefresh?: Date;
      } = {
        lastRefreshed: new Date(),
      };

      if (isManual) {
        updates.lastManualRefresh = new Date();
      }

      await Q.leaderboard.message.update({ id: existing.id }, updates);

      logger.info(
        `Refreshed ${type} leaderboard (${isManual ? "manual" : "automatic"})`,
      );

      return {
        success: true,
        type,
        entries,
      };
    } catch (error) {
      logger.error(`Failed to refresh ${type} leaderboard:`, error);
      return {
        success: false,
        type,
        entries: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /** Runs an automatic refresh for every `LeaderboardType` in parallel; never sets the manual-refresh cooldown. */
  async refreshAll(): Promise<LeaderboardRefreshResult[]> {
    const types = Object.values(LeaderboardType);
    const results = await Promise.all(types.map((type) => this.refresh(type)));

    const successful = results.filter((r) => r.success).length;
    logger.info(`Refreshed ${successful}/${results.length} leaderboards`);

    return results;
  }

  /** Returns whether a manual refresh is allowed under the 1-hour cooldown, plus `remainingSeconds` until the next allowed run when blocked. */
  async canRefresh(type: LeaderboardType): Promise<{
    canRefresh: boolean;
    remainingSeconds?: number;
    lastRefreshed?: Date;
  }> {
    const existing = await Q.leaderboard.message.find({
      leaderboardType: type,
    });

    if (!existing || !existing.lastManualRefresh) {
      return { canRefresh: true };
    }

    const now = Date.now();
    const lastRefresh = existing.lastManualRefresh.getTime();
    const cooldownMs = 60 * 60 * 1000;
    const elapsed = now - lastRefresh;

    if (elapsed >= cooldownMs) {
      return {
        canRefresh: true,
        lastRefreshed: existing.lastManualRefresh,
      };
    }

    const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);

    return {
      canRefresh: false,
      remainingSeconds,
      lastRefreshed: existing?.lastManualRefresh,
    };
  }
}
