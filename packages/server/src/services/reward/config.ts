import { type RewardConfig, RewardType } from "./types";

/**
 * Reward system configuration registry
 *
 * Defines all available reward types and their properties
 */
export const REWARD_CONFIGS: Record<RewardType, RewardConfig> = {
  [RewardType.DAILY]: {
    type: RewardType.DAILY,
    amount: 20,
    label: "Daily Reward",
    description: "Claim your daily reward once per day",
    resetHour: 0,
    enabled: true,
  },
};

/**
 * Retrieves configuration for a specific reward type
 *
 * @param type - The reward type to get configuration for
 * @returns The reward configuration object
 * @throws Error if no configuration exists for the given type
 */
export function getRewardConfig(type: RewardType): RewardConfig {
  const config = REWARD_CONFIGS[type];
  if (!config) {
    throw new Error(`No configuration found for reward type: ${type}`);
  }
  return config;
}
