/** Top-level grouping for achievement definitions, used for filtering and display */
export enum AchievementCategory {
  MINING = "mining",
  COMBAT = "combat",
  EXPLORATION = "exploration",
  ECONOMY = "economy",
  PLAYTIME = "playtime",
}

/** Discriminated union describing what data source and key to measure progress against */
export type AchievementCriteria =
  | { source: "minecraft_stat"; statCategory: string; statKey: string }
  | { source: "balance_earned" }
  | { source: "playtime" };

/** A single milestone within an achievement group, unlocked when the player reaches the threshold */
export interface AchievementTier {
  tier: number;
  threshold: number;
  /** Currency reward amount paid out on claim */
  reward: number;
}

/** A named achievement definition containing all tiers that share the same criteria and category */
export interface AchievementGroup {
  /** Stable unique identifier, e.g. "mine_stone" */
  id: string;
  /** Human-readable display name, e.g. "Stone Miner" */
  name: string;
  /** Short description shown to players, e.g. "Mine stone blocks" */
  description: string;
  category: AchievementCategory;
  criteria: AchievementCriteria;
  /** Tiers ordered ascending by tier number */
  tiers: AchievementTier[];
}

/** Progress snapshot for a single achievement group, returned to clients */
export interface AchievementGroupProgress {
  group: AchievementGroup;
  currentValue: number;
  /** Highest tier the player has completed; 0 means none completed yet */
  highestCompletedTier: number;
  completedTiers: {
    tier: number;
    completedAt: Date;
    /** Null if the reward has not been claimed yet */
    claimedAt: Date | null;
  }[];
  /** The next uncompleted tier, or null if all tiers are done */
  nextTier: AchievementTier | null;
}

/** Result returned after a player successfully claims an achievement tier reward */
export interface ClaimResult {
  groupId: string;
  tier: number;
  reward: number;
  newBalance: number;
}
