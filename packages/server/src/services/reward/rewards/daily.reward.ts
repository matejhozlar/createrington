import type { PlayerIdentifier } from "@/generated/db";
import type { RewardClaimResult, RewardEligibilityResult } from "../types";
import { BaseReward } from "./base.reward";
import { balanceRepo, db } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";

/**
 * Daily reward implementation with time-based reset logic
 *
 * Features:
 * - Resets at a configured hour (UTC) each day
 * - Players can claim once per reset period
 * - Smart reset timing: claiming 1 hour before reset allows immediate reclaim after reset
 * - Integrates with balance system for automatic currency distribution
 * - Full audit trail through reward_claim table
 *
 * Reset Behavior:
 * - If reset hour is 0 (midnight UTC):
 *      - Claim at 11 PM UTC -> can claim at midnight UTC (1 hour later)
 *      - Claim at 1 AM UTC -> can claim again tomorrow at midnight UTC (23 hours later)
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}

export class DailyReward extends BaseReward {
  /**
   * Checks if a player is eligible to claim the daily reward
   *
   * Eligibility logic:
   * 1. Never claimed before -> eligible
   * 2. Last claim time + reset period has passed -> eligible
   * 3. Still within current reset period -> not eligible
   *
   * @param identifier - Player identifier (UUID, username, discordId, or Player object)
   * @returns Promise resolving to eligibility result with reason and timing info
   */
  async checkEligibility(
    identifier: PlayerIdentifier,
  ): Promise<RewardEligibilityResult> {
    try {
      const playerUuid = await this.resolvePlayerUuid(identifier);
      const lastClaim = await this.getLastClaim(playerUuid);

      if (!lastClaim) {
        return {
          eligible: true,
        };
      }

      const nextClaimTime = this.getNextClaimTime(lastClaim.claimedAt);
      const now = new Date();

      if (now >= nextClaimTime) {
        return {
          eligible: true,
          lastClaimTime: lastClaim.claimedAt,
        };
      }

      return {
        eligible: false,
        reason: `You can claim again at ${nextClaimTime.toLocaleString()}`,
        nextClaimTime,
        lastClaimTime: lastClaim.claimedAt,
      };
    } catch (error) {
      logger.error("Failed to check daily reward eligibility:", error);
      return {
        eligible: false,
        reason: "Failed to check eligibility",
      };
    }
  }

  /**
   * Claims the daily reward for a player
   *
   * Transaction flow:
   * 1. Verify player eligibility
   * 2. Add currency to player balance (via BalanceRepository)
   * 3. Record claim in reward_claim table
   * 4. Calculate next claim time
   * 5. Return success result
   *
   * All operations are atomic - if any step fails, nothing is committed
   *
   * @param identifier - Player Identifier (UUID, username, discordId, or Player obejct)
   * @returns Promise resolving to claim result with new balance and next claim time
   */
  async claim(identifier: PlayerIdentifier): Promise<RewardClaimResult> {
    try {
      const playerUuid = await this.resolvePlayerUuid(identifier);

      const eligibility = await this.checkEligibility(identifier);
      if (!eligibility.eligible) {
        return {
          success: false,
          error: eligibility.reason,
          nextClaimTime: eligibility.nextClaimTime,
        };
      }

      const claimPeriodKey = this.getCurrentPeriodKey(new Date());

      const newBalance = await db.inTransaction(async (tx) => {
        // Insert first so the unique index settles a concurrent-claim race
        // before any balance is credited.
        await this.recordClaim(
          playerUuid,
          this.config.amount,
          claimPeriodKey,
          { rewardType: this.config.type },
          tx,
        );

        return await balanceRepo.add(
          playerUuid,
          this.config.amount,
          `Daily reward claimed`,
          BalanceTransactionType.REWARD,
          { metadata: { rewardType: this.config.type }, tx },
        );
      });

      const nextClaimTime = this.getNextClaimTime(new Date());

      logger.info(
        `Player ${playerUuid} claimed daily reward: ${this.config.amount}`,
      );

      return {
        success: true,
        amount: this.config.amount,
        newBalance,
        nextClaimTime,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Concurrent claim already won the race for this period.
        const eligibility = await this.checkEligibility(identifier);
        return {
          success: false,
          error: eligibility.reason ?? "Already claimed for this period",
          nextClaimTime: eligibility.nextClaimTime,
        };
      }
      logger.error("Failed to claim daily reward:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private getCurrentPeriodKey(now: Date): string {
    const periodStart = new Date(now);
    periodStart.setUTCHours(this.config.resetHour, 0, 0, 0);
    if (periodStart > now) {
      periodStart.setUTCDate(periodStart.getUTCDate() - 1);
    }
    return periodStart.toISOString().slice(0, 10);
  }

  /**
   * Calculates the next time this reward can be claimed based on reset schedule
   *
   * Reset logic:
   * 1. Start with last claim time
   * 2. Set time to configured reset hour (with minutes/seconds at 0)
   * 3. If that time is before or equal to last claim -> add 1 day
   *
   * This created the behavior where:
   * - Claiming 1 hour before reset = can claim again in 1 hour (after reset)
   * - Claiming 1 hour after reset = can claim again in ~23 hours (next reset)
   *
   * @param lastClaimTime - Timestamp of the last claim
   * @returns Date object representing when player can claim next
   */
  getNextClaimTime(lastClaimTime: Date): Date {
    const nextClaim = new Date(lastClaimTime);

    nextClaim.setUTCHours(this.config.resetHour, 0, 0, 0);

    if (nextClaim <= lastClaimTime) {
      nextClaim.setUTCDate(nextClaim.getUTCDate() + 1);
    }

    return nextClaim;
  }
}
