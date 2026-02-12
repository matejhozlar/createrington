export enum AchievementCategory {
  MINING = "mining",
  COMBAT = "combat",
  EXPLORATION = "exploration",
  ECONOMY = "economy",
  PLAYTIME = "playtime",
}

/** Discriminated union — what to measure */
export type AchievementCriteria =
  | { source: "minecraft_stat"; statCategory: string; statKey: string }
  | { source: "balance_earned" }
  | { source: "playtime" };

export interface AchievementTier {
  tier: number;
  threshold: number;
  /** Currency display amount */
  reward: number;
}

export interface AchievementGroup {
  /** e.g. "mine_stone" */
  id: string;
  /** e.g. "Stone Miner" */
  name: string;
  /** e.g. "Mine stone blocks" */
  description: string;
  category: AchievementCategory;
  criteria: AchievementCriteria;
  /** Ordered by tier number */
  tiers: AchievementTier[];
}

/** Returned to clients */
export interface AchievementGroupProgress {
  group: AchievementGroup;
  currentValue: number;
  /** 0 = none completed */
  highestCompletedTier: number;
  completedTiers: {
    tier: number;
    completedAt: Date;
    claimedAt: Date | null;
  }[];
  nextTier: AchievementTier | null;
}

export interface ClaimResult {
  groupId: string;
  tier: number;
  reward: number;
  newBalance: number;
}
