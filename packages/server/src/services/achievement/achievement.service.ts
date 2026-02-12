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

/**
 * Achievement Service
 *
 * Evaluates player progress against defined achievement tiers,
 * records completions, and handles reward claiming.
 *
 * Triggered automatically after stats imports and can also be
 * queried for progress display on the client.
 */
export class AchievementService {
  /**
   * Initializes the service
   *
   * @returns Promise resolving when the service is initialized
   */
  async initialize(): Promise<void> {
    validateDefinitions();
    logger.info(
      `AchievementService initialized with ${ACHIEVEMENT_GROUPS.length} achievement groups`,
    );
  }

  async shutdown(): Promise<void> {
    // No timers or connections to clean up
  }

  // ==========================================================================
  // EVALUATION
  // ==========================================================================

  /**
   * Evaluate achievements for all players on a server.
   * Called after stats import completes.
   *
   * @param serverId - Server to evaluate for
   * @param playerUuids - Minecraft UUIDs of the players
   * @returns Promise resolving when the server is evaluated
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
   * @param playerUuid - Minecraft UUID of the player
   * @param serverId - Server ID to evaluate on
   * @returns Promise resolving to an object with evaluated achievements
   */
  async evaluatePlayer(
    playerUuid: string,
    serverId: number,
  ): Promise<string[]> {
    // Load completed achievements from DB
    const completedRows = await Q.player.achievement.getCompletedForPlayer(
      playerUuid,
      serverId,
    );

    // Build set of completed (groupId, tier) for fast lookup
    const completedSet = new Set(
      completedRows.map((r) => `${r.achievementGroupId}:${r.tier}`),
    );

    // Load player data for evaluation
    const [stats, playtimeSummary, totalEarned] = await Promise.all([
      Q.player.minecraft.stats
        .find({ minecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.playtime.summary
        .find({ playerMinecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.balance.transaction.getTotalEarned(playerUuid).catch(() => 0),
    ]);

    const statsJson = (stats as any)?.stats ?? {};
    const totalSeconds = playtimeSummary
      ? Number(playtimeSummary.totalSeconds)
      : 0;

    // Evaluate each group
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
      );

      for (const tierDef of group.tiers) {
        const key = `${group.id}:${tierDef.tier}`;

        // Skip already completed tiers
        if (completedSet.has(key)) continue;

        // Check if threshold is met
        if (currentValue >= tierDef.threshold) {
          newCompletions.push({
            achievementGroupId: group.id,
            tier: tierDef.tier,
            rewardAmount: tierDef.reward,
            description: `${group.name} ${toRoman(tierDef.tier)}`,
          });
        } else {
          // Tiers are ordered — if this one isn't met, later ones won't be either
          break;
        }
      }
    }

    // Batch insert new completions
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
  // PROGRESS
  // ==========================================================================

  /**
   * Get progress for all achievement groups for a player on a server.
   * Runs evaluation first to ensure newly earned tiers are captured.
   *
   * @param playerUuid - Minecraft UUID of the player
   * @param serverId - Server to get progress on
   * @returns Promise resolving to an object achievement group progress
   */
  async getProgress(
    playerUuid: string,
    serverId: number,
  ): Promise<AchievementGroupProgress[]> {
    // Evaluate first so progress is always up to date
    await this.evaluatePlayer(playerUuid, serverId);

    const completedRows = await Q.player.achievement.getCompletedForPlayer(
      playerUuid,
      serverId,
    );

    // Group completed rows by achievement group ID
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

    // Load player data
    const [stats, playtimeSummary, totalEarned] = await Promise.all([
      Q.player.minecraft.stats
        .find({ minecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.playtime.summary
        .find({ playerMinecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.balance.transaction.getTotalEarned(playerUuid).catch(() => 0),
    ]);

    const statsJson = (stats as any)?.stats ?? {};
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
   * @param playerUuid - Minecraft UUID of the player
   * @param serverId - Server ID of the claim action
   * @param groupId - Group ID of the achievement
   * @param tier - Tier of the achievement
   * @returns Promise resolving to the claim result
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
   * @param playerUuid - Minecraft UUID of the player
   * @param serverId - Server ID to claim on
   * @returns Promise resolving to claim result
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
   * Resolve the current value for an achievement criteria.
   *
   * @param criteria - Achievement criteria
   * @param stats - Record of stats
   * @param totalSeconds - Number of seconds (playtime)
   * @param totalEarned - Total earned
   * @returns Current value of the achievement
   */
  private getCurrentValue(
    criteria: AchievementCriteria,
    stats: Record<string, any>,
    totalSeconds: number,
    totalEarned: number,
  ): number {
    switch (criteria.source) {
      case "minecraft_stat":
        return stats[criteria.statCategory]?.[criteria.statKey] ?? 0;

      case "playtime":
        return totalSeconds;

      case "balance_earned":
        return totalEarned;

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
