import { DatabaseTable, type PlayerIdentifier } from "@/generated/db";
import { balanceRepo, db, Q } from "@/db";
import { BalanceUtils } from "@/db/utils/balance";
import { UniqueViolationError } from "@/db/utils/errors";

const REWARD_TYPE = "daily";
const ALREADY_CLAIMED = "Already claimed for this period";

const DAILY_REWARD = {
  amount: 20,
  resetHour: 0,
};

type DailyRewardConfig = typeof DAILY_REWARD;

interface DailyRewardEligibility {
  eligible: boolean;
  reason?: string;
  nextClaimTime?: Date;
  lastClaimTime?: Date;
}

interface DailyRewardClaimResult {
  success: boolean;
  amount?: number;
  newBalance?: number;
  error?: string;
  nextClaimTime?: Date;
}

/**
 * Daily currency reward: one claim per period, where a period starts at the
 * configured UTC reset hour. A claim just before the reset can be followed by
 * another right after it. Every claim is a `reward_claim` row plus a balance
 * credit in one transaction, and the row's unique index on the period settles
 * concurrent claims before anything is credited.
 */
export class DailyRewardService {
  constructor(private readonly config: DailyRewardConfig = DAILY_REWARD) {}

  /** Whether the player can claim now; never throws, a failed lookup reports ineligible. */
  async checkEligibility(
    identifier: PlayerIdentifier,
  ): Promise<DailyRewardEligibility> {
    try {
      const playerUuid = await this.resolvePlayerUuid(identifier);
      const lastClaimTime = await this.getLastClaimTime(playerUuid);

      if (!lastClaimTime) {
        return { eligible: true };
      }

      const nextClaimTime = this.getNextClaimTime(lastClaimTime);
      if (new Date() >= nextClaimTime) {
        return { eligible: true, lastClaimTime };
      }

      return {
        eligible: false,
        reason: ALREADY_CLAIMED,
        nextClaimTime,
        lastClaimTime,
      };
    } catch (error) {
      logger.error("Failed to check daily reward eligibility:", error);
      return {
        eligible: false,
        reason: "Failed to check eligibility",
      };
    }
  }

  /** Claims the reward and credits the balance atomically; never throws, a refused or failed claim reports `success: false`. */
  async claim(identifier: PlayerIdentifier): Promise<DailyRewardClaimResult> {
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

      const { amount } = this.config;
      const metadata = { rewardType: REWARD_TYPE };
      const claimPeriodKey = this.getCurrentPeriodKey(new Date());

      const newBalance = await db.inTransaction(async (tx) => {
        await tx.reward.claim.create({
          playerMinecraftUuid: playerUuid,
          rewardType: REWARD_TYPE,
          claimPeriodKey,
          amount: BalanceUtils.toStorage(amount),
          metadata,
        });

        return await balanceRepo.add(
          playerUuid,
          amount,
          "Daily reward claimed",
          "reward",
          { metadata, tx },
        );
      });

      logger.info(`Player ${playerUuid} claimed daily reward: ${amount}`);

      return {
        success: true,
        amount,
        newBalance,
        nextClaimTime: this.getNextClaimTime(new Date()),
      };
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        const eligibility = await this.checkEligibility(identifier);
        return {
          success: false,
          error: eligibility.reason ?? ALREADY_CLAIMED,
          nextClaimTime: eligibility.nextClaimTime,
        };
      }
      logger.error("Failed to claim daily reward:", error);
      return {
        success: false,
        error: "Failed to claim daily reward",
      };
    }
  }

  /** The first reset after `lastClaimTime`, i.e. when a player who claimed then can claim again. */
  getNextClaimTime(lastClaimTime: Date): Date {
    const nextClaim = new Date(lastClaimTime);
    nextClaim.setUTCHours(this.config.resetHour, 0, 0, 0);
    if (nextClaim <= lastClaimTime) {
      nextClaim.setUTCDate(nextClaim.getUTCDate() + 1);
    }
    return nextClaim;
  }

  private getCurrentPeriodKey(now: Date): string {
    const periodStart = new Date(now);
    periodStart.setUTCHours(this.config.resetHour, 0, 0, 0);
    if (periodStart > now) {
      periodStart.setUTCDate(periodStart.getUTCDate() - 1);
    }
    return periodStart.toISOString().slice(0, 10);
  }

  private async resolvePlayerUuid(
    identifier: PlayerIdentifier,
  ): Promise<string> {
    if (typeof identifier === "string") return identifier;
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return identifier.minecraftUuid;
    }
    const player = await Q.player.get(identifier);
    return player.minecraftUuid;
  }

  private async getLastClaimTime(playerUuid: string): Promise<Date | null> {
    const [lastClaim] = await Q.reward.claim.findAll(
      { playerMinecraftUuid: playerUuid, rewardType: REWARD_TYPE },
      {
        limit: 1,
        orderBy: DatabaseTable.REWARD_CLAIM.CAMEL_FIELDS.CLAIMED_AT,
        orderDirection: "desc",
      },
    );
    return lastClaim?.claimedAt ?? null;
  }
}

export const dailyRewardService = new DailyRewardService();
