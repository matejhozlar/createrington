import { getRewardConfig } from "./config";
import { BaseReward } from "./rewards/base.reward";
import { DailyReward } from "./rewards/daily.reward";
import { RewardType } from "./types";

/**
 * Main reward service
 *
 * Provides a unified interface for accessing different reward types through
 * a clean, type-safe API. Each reward type is initialized once and cached.
 *
 * Architecture:
 * - Singleton pattern ensures a single instance across the app
 * - Each reward type extends BaseReward with custom claim logic
 * - Only enabled rewards are initialized
 */
export class RewardService {
  private rewards: Map<RewardType, BaseReward> = new Map();

  constructor() {
    this.initializeRewards();
  }

  /**
   * Initializes all enabled reward types from configuration
   *
   * Only enabled rewards are initialized to avoid unnecessary overhead
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
   * Retrieves a specific reward instance by type
   *
   * @param type - The reward type to retrieve
   * @returns The reward instance
   * @throws Error if reward type is not found or not enabled
   *
   * @private
   */
  private getReward(type: RewardType): BaseReward {
    const reward = this.rewards.get(type);
    if (!reward) {
      throw new Error(`Reward type ${type} not found or not enabled`);
    }
    return reward;
  }

  /**
   * Accessor for daily reward operations
   *
   * Provides methods:
   * - checkEligibility(player): Check if a player can claim
   * - claim(player): Claim reward
   * - getNextClaimTime(lastClaim): Calculate next claim
   *
   * @returns DailyReward instance
   * @throws Error if daily rewards are not enabled
   */
  get daily(): BaseReward {
    return this.getReward(RewardType.DAILY);
  }

  /**
   * Get all currently available (enabled) reward types
   *
   * @returns Array of enabled reward type identifiers
   */
  getAvailableRewards(): RewardType[] {
    return Array.from(this.rewards.keys());
  }
}

/** Singleton instance of the reward service */
export const rewardService = new RewardService();
