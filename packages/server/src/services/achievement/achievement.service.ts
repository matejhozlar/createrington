import { Q } from "@/db";
import { balanceRepo } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import {
  ACHIEVEMENT_GROUPS,
  getGroupById,
  validateDefinitions,
} from "./definitions";
import type {
  AchievementCriteria,
  AchievementGroupProgress,
  AchievementTier,
  ClaimResult,
} from "./types";
import type { PlayerMinecraftStats } from "@createrington/shared/db";

/** Pre-loaded crypto data for achievement evaluation */
interface CryptoData {
  tradeCount: number;
  uniqueHoldings: number;
  portfolioValue: number;
}

/**
 * Achievement Service
 *
 * Evaluates player progress against defined achievement tiers,
 * records completions, and handles reward claiming:
 * - Evaluates all achievement groups after stats imports (per server)
 * - Hooks into crypto trade events to award trade-based and event-based achievements
 * - Runs daily cron checks for time-gated achievements (Diamond Hands)
 * - Responds to token crash events to award crash-related achievements
 * - Exposes progress queries for client display
 * - Handles reward claiming and credits player balance on claim
 *
 * NOTE: Crypto achievements are treated as global — they are awarded and checked
 * across every server the player has playtime on
 */
export class AchievementService {
  /** Validates achievement definitions and logs the count of registered groups */
  async initialize(): Promise<void> {
    validateDefinitions();
    logger.info(
      `AchievementService initialized with ${ACHIEVEMENT_GROUPS.length} achievement groups`,
    );
  }

  /** No-op shutdown — service has no timers or connections to clean up */
  async shutdown(): Promise<void> {}

  // ==========================================================================
  // EVALUATION
  // ==========================================================================

  /**
   * Evaluate achievements for all players on a server.
   * Called after stats import completes.
   *
   * @param serverId - The server to evaluate achievements for
   * @param playerUuids - Minecraft UUIDs of players to evaluate
   */
  async evaluateServer(serverId: number, playerUuids: string[]): Promise<void> {
    let totalNew = 0;

    for (const uuid of playerUuids) {
      try {
        const newAchievements = await this.evaluatePlayer(uuid, serverId);
        totalNew += newAchievements.length;
      } catch (error) {
        logger.error(
          `Achievement evaluation failed for player ${uuid} on server ${serverId}:`,
          error,
        );
      }
    }

    if (totalNew > 0) {
      logger.info(
        `Achievement evaluation complete for server ${serverId}: ${totalNew} new achievement(s) across ${playerUuids.length} player(s)`,
      );
    }
  }

  /**
   * Evaluate all achievement groups for a single player on a server.
   *
   * Loads Minecraft stats, playtime, balance history, and crypto data in parallel,
   * then checks every unearned tier against the player's current value. Newly
   * completed tiers are batch-inserted in a single query.
   *
   * @param playerUuid - Minecraft UUID of the player to evaluate
   * @param serverId - The server context for stats and playtime lookups
   * @returns Names of newly completed achievements (formatted as "Group Name tier-roman")
   */
  async evaluatePlayer(
    playerUuid: string,
    serverId: number,
  ): Promise<string[]> {
    const completedRows = await Q.player.achievement.getCompletedForPlayer(
      playerUuid,
      serverId,
    );

    // Build set of completed (groupId, tier) pairs for fast O(1) lookup during tier iteration
    const completedSet = new Set(
      completedRows.map((r) => `${r.achievementGroupId}:${r.tier}`),
    );

    // Load player data for evaluation (Minecraft + crypto in parallel)
    const [stats, playtimeSummary, totalEarned, cryptoData] = await Promise.all(
      [
        Q.player.minecraft.stats
          .find({ minecraftUuid: playerUuid, serverId })
          .catch(() => null),
        Q.player.playtime.summary
          .find({ playerMinecraftUuid: playerUuid, serverId })
          .catch(() => null),
        Q.player.balance.transaction.getTotalEarned(playerUuid).catch(() => 0),
        this.loadCryptoData(playerUuid),
      ],
    );

    const statsJson = (stats as PlayerMinecraftStats)?.stats ?? {};
    const totalSeconds = playtimeSummary
      ? Number(playtimeSummary.totalSeconds)
      : 0;

    const newCompletions: {
      achievementGroupId: string;
      tier: number;
      rewardAmount: number;
      description: string;
    }[] = [];

    for (const group of ACHIEVEMENT_GROUPS) {
      const currentValue = this.getCurrentValue(
        group.criteria,
        statsJson,
        totalSeconds,
        totalEarned,
        cryptoData,
      );

      for (const tierDef of group.tiers) {
        const key = `${group.id}:${tierDef.tier}`;
        if (completedSet.has(key)) continue;

        if (currentValue >= tierDef.threshold) {
          newCompletions.push({
            achievementGroupId: group.id,
            tier: tierDef.tier,
            rewardAmount: tierDef.reward,
            description: `${group.name} ${toRoman(tierDef.tier)}`,
          });
        } else {
          // Tiers are ordered — if this threshold isn't met, higher ones won't be either
          break;
        }
      }
    }

    if (newCompletions.length > 0) {
      await Q.player.achievement.batchComplete(
        playerUuid,
        serverId,
        newCompletions.map((c) => ({
          achievementGroupId: c.achievementGroupId,
          tier: c.tier,
          rewardAmount: c.rewardAmount,
        })),
      );

      logger.debug(
        `Player ${playerUuid} completed ${newCompletions.length} achievement(s) on server ${serverId}: ${newCompletions.map((c) => c.description).join(", ")}`,
      );
    }

    return newCompletions.map((c) => c.description);
  }

  // ==========================================================================
  // CRYPTO ACHIEVEMENT HOOKS
  // ==========================================================================

  /**
   * Evaluate crypto-related achievements after a trade.
   * Awards on all servers the player has data on.
   *
   * @returns Names of newly completed achievements across all servers
   */
  async evaluateCryptoAchievements(playerUuid: string): Promise<string[]> {
    const serverIds = await this.getPlayerServerIds(playerUuid);
    if (serverIds.length === 0) return [];

    const allNew: string[] = [];
    for (const serverId of serverIds) {
      const newAchievements = await this.evaluatePlayer(playerUuid, serverId);
      // Deduplicate — same achievement name may be awarded on multiple servers
      for (const name of newAchievements) {
        if (!allNew.includes(name)) allNew.push(name);
      }
    }
    return allNew;
  }

  /**
   * Directly award an event-based crypto achievement (e.g. Paper Hands, 10x Return).
   * Records on all servers the player has data on. Idempotent via ON CONFLICT DO NOTHING.
   *
   * @returns true if the achievement was newly awarded (on at least one server)
   */
  async awardCryptoEvent(
    playerUuid: string,
    groupId: string,
  ): Promise<boolean> {
    const group = getGroupById(groupId);
    if (!group) {
      logger.warn(`Unknown achievement group for crypto event: ${groupId}`);
      return false;
    }

    const serverIds = await this.getPlayerServerIds(playerUuid);
    if (serverIds.length === 0) return false;

    let awarded = false;
    for (const serverId of serverIds) {
      const completedRows = await Q.player.achievement.getCompletedForPlayer(
        playerUuid,
        serverId,
      );
      const alreadyCompleted = completedRows.some(
        (r) => r.achievementGroupId === groupId && r.tier === 1,
      );

      if (!alreadyCompleted) {
        await Q.player.achievement.batchComplete(playerUuid, serverId, [
          {
            achievementGroupId: groupId,
            tier: 1,
            rewardAmount: group.tiers[0].reward,
          },
        ]);
        awarded = true;
      }
    }

    if (awarded) {
      logger.debug(
        `Awarded crypto achievement "${group.name}" to player ${playerUuid}`,
      );
    }

    return awarded;
  }

  /**
   * Check and award Diamond Hands achievement for all players.
   * Called from a daily cron job.
   */
  async evaluateDiamondHands(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find holdings created 30+ days ago
    const oldHoldings = await Q.crypto.holding
      .where({ createdAt: { $lte: thirtyDaysAgo } })
      .all();

    // Deduplicate by player UUID
    const playerUuids = [
      ...new Set(oldHoldings.map((h) => h.playerMinecraftUuid)),
    ];

    let awarded = 0;
    for (const uuid of playerUuids) {
      const result = await this.awardCryptoEvent(uuid, "crypto_diamond_hands");
      if (result) awarded++;
    }

    if (awarded > 0) {
      logger.info(`Diamond Hands: awarded to ${awarded} player(s)`);
    }
  }

  /**
   * Award Crash Survivor to holders who held through a crash,
   * and Bag Holder to holders of crashed tokens.
   * Called when a token crashes.
   */
  async evaluateCrashAchievements(tokenId: number): Promise<void> {
    const holdings = await Q.crypto.holding.where({ tokenId }).all();

    let crashSurvivorCount = 0;
    let bagHolderCount = 0;

    for (const holding of holdings) {
      // Anyone still holding when it crashes is a Crash Survivor
      const survivorResult = await this.awardCryptoEvent(
        holding.playerMinecraftUuid,
        "crypto_crash_survivor",
      );
      if (survivorResult) crashSurvivorCount++;

      // Bag Holder — they're holding a worthless token
      const bagResult = await this.awardCryptoEvent(
        holding.playerMinecraftUuid,
        "crypto_bag_holder",
      );
      if (bagResult) bagHolderCount++;
    }

    if (crashSurvivorCount > 0 || bagHolderCount > 0) {
      logger.info(
        `Crash achievements for token ${tokenId}: ${crashSurvivorCount} Crash Survivor(s), ${bagHolderCount} Bag Holder(s)`,
      );
    }
  }

  /**
   * Check if a player has completed a specific achievement.
   * Used by the fee calculator for Market Veteran discount.
   */
  async hasAchievement(playerUuid: string, groupId: string): Promise<boolean> {
    const serverIds = await this.getPlayerServerIds(playerUuid);
    if (serverIds.length === 0) return false;

    // Check on the first server — crypto achievements are global
    const completed = await Q.player.achievement.getCompletedForPlayer(
      playerUuid,
      serverIds[0],
    );
    return completed.some(
      (r) => r.achievementGroupId === groupId && r.tier >= 1,
    );
  }

  // ==========================================================================
  // PROGRESS
  // ==========================================================================

  /**
   * Get progress for all achievement groups for a player on a server.
   * Runs evaluation first to ensure newly earned tiers are captured.
   *
   * @param playerUuid - Minecraft UUID of the player
   * @param serverId - The server context for stats and playtime lookups
   * @returns Progress snapshot for every defined achievement group
   */
  async getProgress(
    playerUuid: string,
    serverId: number,
  ): Promise<AchievementGroupProgress[]> {
    await this.evaluatePlayer(playerUuid, serverId);

    const completedRows = await Q.player.achievement.getCompletedForPlayer(
      playerUuid,
      serverId,
    );

    const completedByGroup = new Map<
      string,
      { tier: number; completedAt: Date; claimedAt: Date | null }[]
    >();
    for (const row of completedRows) {
      const list = completedByGroup.get(row.achievementGroupId) ?? [];
      list.push({
        tier: row.tier,
        completedAt: row.completedAt,
        claimedAt: row.claimedAt,
      });
      completedByGroup.set(row.achievementGroupId, list);
    }

    const [stats, playtimeSummary, totalEarned, cryptoData] = await Promise.all(
      [
        Q.player.minecraft.stats
          .find({ minecraftUuid: playerUuid, serverId })
          .catch(() => null),
        Q.player.playtime.summary
          .find({ playerMinecraftUuid: playerUuid, serverId })
          .catch(() => null),
        Q.player.balance.transaction.getTotalEarned(playerUuid).catch(() => 0),
        this.loadCryptoData(playerUuid),
      ],
    );

    const statsJson = (stats as PlayerMinecraftStats)?.stats ?? {};
    const totalSeconds = playtimeSummary
      ? Number(playtimeSummary.totalSeconds)
      : 0;

    return ACHIEVEMENT_GROUPS.map((group) => {
      const completedTiers = completedByGroup.get(group.id) ?? [];
      const highestCompletedTier = completedTiers.reduce(
        (max, t) => Math.max(max, t.tier),
        0,
      );

      const currentValue = this.getCurrentValue(
        group.criteria,
        statsJson,
        totalSeconds,
        totalEarned,
        cryptoData,
      );

      const nextTier: AchievementTier | null =
        group.tiers.find((t) => t.tier === highestCompletedTier + 1) ?? null;

      return {
        group,
        currentValue,
        highestCompletedTier,
        completedTiers,
        nextTier,
      };
    });
  }

  // ==========================================================================
  // CLAIMING
  // ==========================================================================

  /**
   * Claim reward for a single completed achievement tier.
   *
   * Marks the tier as claimed in the database and credits the reward
   * amount to the player's balance as a `REWARD` transaction.
   *
   * @param playerUuid - Minecraft UUID of the player claiming the reward
   * @param serverId - The server context the achievement was completed on
   * @param groupId - Achievement group identifier
   * @param tier - Tier number within the group to claim
   * @returns Claim result including the reward amount and updated balance
   */
  async claim(
    playerUuid: string,
    serverId: number,
    groupId: string,
    tier: number,
  ): Promise<ClaimResult> {
    const group = getGroupById(groupId);
    if (!group) {
      throw new Error(`Unknown achievement group: ${groupId}`);
    }

    const rewardAmount = await Q.player.achievement.claimAndReturnReward(
      playerUuid,
      serverId,
      groupId,
      tier,
    );

    if (rewardAmount === null) {
      throw new Error(
        `No unclaimed achievement found: ${groupId} tier ${tier}`,
      );
    }

    const newBalance = await balanceRepo.add(
      { minecraftUuid: playerUuid },
      rewardAmount,
      `Achievement reward: ${group.name} ${toRoman(tier)}`,
      BalanceTransactionType.REWARD,
    );

    return {
      groupId,
      tier,
      reward: rewardAmount,
      newBalance,
    };
  }

  /**
   * Claim all unclaimed completed achievements for a player on a server.
   *
   * Errors on individual claims are logged and skipped so a single failure
   * does not prevent the remaining claims from being processed.
   *
   * @param playerUuid - Minecraft UUID of the player
   * @param serverId - The server context to claim achievements for
   * @returns Array of successful claim results (may be empty if nothing is unclaimed)
   */
  async claimAll(playerUuid: string, serverId: number): Promise<ClaimResult[]> {
    const unclaimed = await Q.player.achievement.getUnclaimedForPlayer(
      playerUuid,
      serverId,
    );

    if (unclaimed.length === 0) return [];

    const results: ClaimResult[] = [];

    for (const row of unclaimed) {
      try {
        const result = await this.claim(
          playerUuid,
          serverId,
          row.achievementGroupId,
          row.tier,
        );
        results.push(result);
      } catch (error) {
        logger.error(
          `Failed to claim achievement ${row.achievementGroupId} tier ${row.tier} for ${playerUuid}:`,
          error,
        );
      }
    }

    return results;
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Load crypto market data for a player in parallel (trade count, holdings, portfolio value).
   *
   * All three queries are best-effort — any failure falls back to a safe zero/empty value
   * so a crypto data outage does not block the broader achievement evaluation.
   *
   * @private
   * @param playerUuid - Minecraft UUID of the player
   * @returns Aggregated crypto data used by criteria resolution
   */
  private async loadCryptoData(playerUuid: string): Promise<CryptoData> {
    const [tradeCount, holdings, tokens] = await Promise.all([
      Q.crypto.transaction
        .where({ playerMinecraftUuid: playerUuid })
        .count()
        .catch(() => 0),
      Q.crypto.holding
        .where({ playerMinecraftUuid: playerUuid })
        .all()
        .catch(() => []),
      Q.crypto.token
        .where({})
        .all()
        .catch(() => []),
    ]);

    const tokenPrices = new Map(tokens.map((t) => [t.id, Number(t.price)]));
    let portfolioValue = 0;
    for (const h of holdings) {
      const price = tokenPrices.get(h.tokenId) ?? 0;
      portfolioValue += Number(h.amount) * price;
    }

    return {
      tradeCount,
      uniqueHoldings: holdings.length,
      portfolioValue,
    };
  }

  /**
   * Get all server IDs the player has playtime on.
   *
   * Falls back to every known server if the player has no playtime records yet,
   * ensuring newly joined players can still receive crypto achievements.
   *
   * @private
   * @param playerUuid - Minecraft UUID of the player
   * @returns Deduplicated list of server IDs
   */
  private async getPlayerServerIds(playerUuid: string): Promise<number[]> {
    const summaries = await Q.player.playtime.summary
      .where({ playerMinecraftUuid: playerUuid })
      .all()
      .catch(() => []);

    if (summaries.length > 0) {
      return [...new Set(summaries.map((s) => s.serverId))];
    }

    // Fallback: use all servers if no playtime data yet
    const servers = await Q.server
      .where({})
      .all()
      .catch(() => []);
    return servers.map((s) => s.id);
  }

  /**
   * Resolve the current numeric value for an achievement criteria source.
   *
   * Returns 0 for `crypto_event` criteria — those achievements are awarded
   * directly via `awardCryptoEvent` and never pass through threshold evaluation.
   *
   * @private
   * @param criteria - The criteria definition specifying the data source
   * @param stats - Raw Minecraft stats keyed by category then stat key
   * @param totalSeconds - Cumulative playtime in seconds on the server
   * @param totalEarned - Total balance earned across all time
   * @param cryptoData - Pre-loaded crypto market data for the player
   * @returns Current value to compare against tier thresholds
   */
  private getCurrentValue(
    criteria: AchievementCriteria,
    stats: Record<string, Record<string, number>>,
    totalSeconds: number,
    totalEarned: number,
    cryptoData: CryptoData,
  ): number {
    switch (criteria.source) {
      case "minecraft_stat":
        return stats[criteria.statCategory]?.[criteria.statKey] ?? 0;

      case "playtime":
        return totalSeconds;

      case "balance_earned":
        return totalEarned;

      case "crypto_trade_count":
        return cryptoData.tradeCount;

      case "crypto_unique_holdings":
        return cryptoData.uniqueHoldings;

      case "crypto_portfolio_value":
        return cryptoData.portfolioValue;

      case "crypto_event":
        // Event-based achievements are awarded directly, not via threshold evaluation
        return 0;

      default:
        return 0;
    }
  }
}

/** Convert tier number to roman numeral (supports 1-10) */
function toRoman(n: number): string {
  const numerals = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
  ];
  return numerals[n] ?? String(n);
}
