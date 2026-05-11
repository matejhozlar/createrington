import { getRewardConfig } from "./config";
import { BaseReward } from "./rewards/base.reward";
import { DailyReward } from "./rewards/daily.reward";
import { RewardType } from "./types";

/**
 * Reward Service
 *
 * Unified entry point for all player reward types:
 * - Initializes only enabled reward types from configuration
 * - Caches each reward instance and exposes it via a typed accessor
 * - Provides a list of all currently active reward types
 *
 * NOTE: Each reward type extends BaseReward; add new types to
 * `initializeRewards()` and expose a corresponding getter
 */
export class RewardService {
  private rewards: Map<RewardType, BaseReward> = new Map();

  constructor() {
    this.initializeRewards();
  }

  /**
   * Initializes all enabled reward types from configuration.
   *
   * @private
   */
  private initializeRewards(): void {
    const dailyConfig = getRewardConfig(RewardType.DAILY);
    if (dailyConfig.enabled) {
      this.rewards.set(RewardType.DAILY, new DailyReward(dailyConfig));
    }

    // TODO add more reward types

    logger.info(`Initialized ${this.rewards.size} reward type(s)`);
  }

  /**
   * Returns the cached reward instance for the given type.
   *
   * @private
   * @param type - The reward type to retrieve
   * @returns The corresponding BaseReward instance
   * @throws Error if the reward type is not found or not enabled
   */
  private getReward(type: RewardType): BaseReward {
    const reward = this.rewards.get(type);
    if (!reward) {
      throw new Error(`Reward type ${type} not found or not enabled`);
    }
    return reward;
  }

  /**
   * Daily reward accessor: provides `checkEligibility`, `claim`, and `getNextClaimTime`.
   *
   * @returns The DailyReward instance
   * @throws Error if daily rewards are not enabled
   */
  get daily(): BaseReward {
    return this.getReward(RewardType.DAILY);
  }

  /**
   * Returns the list of currently enabled reward type identifiers.
   *
   * @returns Array of enabled RewardType values
   */
  getAvailableRewards(): RewardType[] {
    return Array.from(this.rewards.keys());
  }
}

/** Singleton instance of the reward service */
export const rewardService = new RewardService();
