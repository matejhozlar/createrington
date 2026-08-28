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

/**
 * Achievement Service
 *
 * Evaluates player progress against defined achievement tiers,
 * records completions, and handles reward claiming:
 * - Evaluates all achievement groups after stats imports (per server)
 * - Exposes progress queries for client display
 * - Handles reward claiming and credits player balance on claim
 */
export class AchievementService {
  /** Validates achievement definitions and logs the count of registered groups */
  async initialize(): Promise<void> {
    validateDefinitions();
    logger.info(
      `AchievementService initialized with ${ACHIEVEMENT_GROUPS.length} achievement groups`,
    );
  }

  /** No-op shutdown: service has no timers or connections to clean up */
  async shutdown(): Promise<void> {}

  /** Evaluates every player on a server in sequence. Individual player failures are logged and skipped. */
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
   * Evaluates every group for one player, batch-inserts newly completed tiers,
   * and returns their formatted names ("Group Name tier-roman"). Tier iteration
   * short-circuits once a threshold fails (tiers are ordered).
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

    // Load player data for evaluation in parallel
    const [stats, playtimeSummary, totalEarned] = await Promise.all([
      Q.player.minecraft.stats
        .find({ minecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.playtime.summary
        .find({ playerMinecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.balance.transaction.getTotalEarned(playerUuid).catch(() => 0),
    ]);

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
          // Tiers are ordered: if this threshold isn't met, higher ones won't be either
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

  /** Re-evaluates the player, then returns a progress snapshot for every defined group (current value, highest tier, next tier). */
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

    const [stats, playtimeSummary, totalEarned] = await Promise.all([
      Q.player.minecraft.stats
        .find({ minecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.playtime.summary
        .find({ playerMinecraftUuid: playerUuid, serverId })
        .catch(() => null),
      Q.player.balance.transaction.getTotalEarned(playerUuid).catch(() => 0),
    ]);

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

  /** Marks the tier claimed and credits the reward to the player's balance as a REWARD transaction. Throws if the tier isn't unclaimed. */
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

  /** Claims every unclaimed completed tier on the server in sequence. Per-tier failures are logged and skipped. */
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

  private getCurrentValue(
    criteria: AchievementCriteria,
    stats: Record<string, Record<string, number>>,
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
