import { AchievementCategory, type AchievementGroup } from "./types";

/** All achievement group definitions, organized by category */
export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  {
    id: "mine_stone",
    name: "Stone Miner",
    description: "Mine stone blocks",
    category: AchievementCategory.MINING,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:mined",
      statKey: "minecraft:stone",
    },
    tiers: [
      { tier: 1, threshold: 100, reward: 25 },
      { tier: 2, threshold: 1_000, reward: 50 },
      { tier: 3, threshold: 10_000, reward: 100 },
    ],
  },
  {
    id: "mine_deepslate",
    name: "Deep Miner",
    description: "Mine deepslate blocks",
    category: AchievementCategory.MINING,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:mined",
      statKey: "minecraft:deepslate",
    },
    tiers: [
      { tier: 1, threshold: 100, reward: 25 },
      { tier: 2, threshold: 1_000, reward: 50 },
      { tier: 3, threshold: 10_000, reward: 100 },
    ],
  },
  {
    id: "mine_diamond_ore",
    name: "Diamond Hunter",
    description: "Mine diamond ore",
    category: AchievementCategory.MINING,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:mined",
      statKey: "minecraft:diamond_ore",
    },
    tiers: [
      { tier: 1, threshold: 10, reward: 50 },
      { tier: 2, threshold: 100, reward: 100 },
      { tier: 3, threshold: 500, reward: 200 },
    ],
  },

  {
    id: "kill_zombie",
    name: "Zombie Slayer",
    description: "Kill zombies",
    category: AchievementCategory.COMBAT,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:killed",
      statKey: "minecraft:zombie",
    },
    tiers: [
      { tier: 1, threshold: 50, reward: 25 },
      { tier: 2, threshold: 500, reward: 50 },
      { tier: 3, threshold: 5_000, reward: 100 },
    ],
  },
  {
    id: "kill_skeleton",
    name: "Bone Collector",
    description: "Kill skeletons",
    category: AchievementCategory.COMBAT,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:killed",
      statKey: "minecraft:skeleton",
    },
    tiers: [
      { tier: 1, threshold: 50, reward: 25 },
      { tier: 2, threshold: 500, reward: 50 },
      { tier: 3, threshold: 5_000, reward: 100 },
    ],
  },
  {
    id: "kill_creeper",
    name: "Creeper Clearer",
    description: "Kill creepers",
    category: AchievementCategory.COMBAT,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:killed",
      statKey: "minecraft:creeper",
    },
    tiers: [
      { tier: 1, threshold: 25, reward: 30 },
      { tier: 2, threshold: 250, reward: 75 },
      { tier: 3, threshold: 2_500, reward: 150 },
    ],
  },

  {
    id: "walk_distance",
    name: "Wanderer",
    description: "Walk long distances",
    category: AchievementCategory.EXPLORATION,
    criteria: {
      source: "minecraft_stat",
      statCategory: "minecraft:custom",
      statKey: "minecraft:walk_one_cm",
    },
    tiers: [
      { tier: 1, threshold: 100_000, reward: 25 },
      { tier: 2, threshold: 1_000_000, reward: 50 },
      { tier: 3, threshold: 10_000_000, reward: 100 },
    ],
  },

  {
    id: "balance_earned",
    name: "Earner",
    description: "Earn currency through transactions",
    category: AchievementCategory.ECONOMY,
    criteria: { source: "balance_earned" },
    tiers: [
      { tier: 1, threshold: 100, reward: 10 },
      { tier: 2, threshold: 1_000, reward: 50 },
      { tier: 3, threshold: 10_000, reward: 200 },
    ],
  },

  {
    id: "playtime",
    name: "Dedicated Player",
    description: "Spend time on the server",
    category: AchievementCategory.PLAYTIME,
    criteria: { source: "playtime" },
    tiers: [
      { tier: 1, threshold: 3_600, reward: 25 },
      { tier: 2, threshold: 36_000, reward: 75 },
      { tier: 3, threshold: 360_000, reward: 200 },
    ],
  },

  {
    id: "crypto_first_trade",
    name: "First Trade",
    description: "Complete your first buy or sell",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_trade_count" },
    tiers: [{ tier: 1, threshold: 1, reward: 10 }],
  },
  {
    id: "crypto_diversified",
    name: "Diversified",
    description: "Hold 5+ different tokens simultaneously",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_unique_holdings" },
    tiers: [{ tier: 1, threshold: 5, reward: 50 }],
  },
  {
    id: "crypto_diamond_hands",
    name: "Diamond Hands",
    description: "Hold a token for 30+ days",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_event", eventType: "diamond_hands" },
    tiers: [{ tier: 1, threshold: 1, reward: 100 }],
  },
  {
    id: "crypto_paper_hands",
    name: "Paper Hands",
    description: "Sell within 5 minutes of buying",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_event", eventType: "paper_hands" },
    tiers: [{ tier: 1, threshold: 1, reward: 0 }],
  },
  {
    id: "crypto_whale",
    name: "Whale",
    description: "Own >10% of any single token's supply",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_event", eventType: "whale" },
    tiers: [{ tier: 1, threshold: 1, reward: 0 }],
  },
  {
    id: "crypto_crash_survivor",
    name: "Crash Survivor",
    description: "Hold a token through a crash event without selling",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_event", eventType: "crash_survivor" },
    tiers: [{ tier: 1, threshold: 1, reward: 100 }],
  },
  {
    id: "crypto_10x_return",
    name: "10x Return",
    description: "Sell a token at 10x your purchase price",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_event", eventType: "10x_return" },
    tiers: [{ tier: 1, threshold: 1, reward: 200 }],
  },
  {
    id: "crypto_market_veteran",
    name: "Market Veteran",
    description: "Complete 100 trades",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_trade_count" },
    tiers: [{ tier: 1, threshold: 100, reward: 200 }],
  },
  {
    id: "crypto_wolf",
    name: "Wolf of Createrington",
    description: "Reach $100,000 portfolio value",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_portfolio_value" },
    tiers: [{ tier: 1, threshold: 100_000, reward: 500 }],
  },
  {
    id: "crypto_bag_holder",
    name: "Bag Holder",
    description: "Hold a crashed token worth $0",
    category: AchievementCategory.TRADING,
    criteria: { source: "crypto_event", eventType: "bag_holder" },
    tiers: [{ tier: 1, threshold: 1, reward: 0 }],
  },
];

// Pre-built at module load for O(1) lookups at runtime
const groupByIdMap = new Map(ACHIEVEMENT_GROUPS.map((g) => [g.id, g]));

const groupsByCategoryMap = new Map<string, AchievementGroup[]>();
for (const group of ACHIEVEMENT_GROUPS) {
  const existing = groupsByCategoryMap.get(group.category) ?? [];
  existing.push(group);
  groupsByCategoryMap.set(group.category, existing);
}

/** Looks up an achievement group by its unique ID */
export function getGroupById(id: string): AchievementGroup | undefined {
  return groupByIdMap.get(id);
}

/** Returns all achievement groups belonging to a category */
export function getGroupsByCategory(category: string): AchievementGroup[] {
  return groupsByCategoryMap.get(category) ?? [];
}

/**
 * Validates all achievement definitions on service startup.
 * Throws if any definition is invalid.
 */
export function validateDefinitions(): void {
  const seenIds = new Set<string>();

  for (const group of ACHIEVEMENT_GROUPS) {
    // No duplicate group IDs
    if (seenIds.has(group.id)) {
      throw new Error(`Duplicate achievement group ID: "${group.id}"`);
    }
    seenIds.add(group.id);

    // Tiers must be sequential starting at 1
    for (let i = 0; i < group.tiers.length; i++) {
      const tier = group.tiers[i];
      if (tier.tier !== i + 1) {
        throw new Error(
          `Achievement "${group.id}": tier ${tier.tier} at index ${i} should be ${i + 1}`,
        );
      }

      if (tier.reward < 0) {
        throw new Error(
          `Achievement "${group.id}" tier ${tier.tier}: reward must be non-negative`,
        );
      }

      // Thresholds must be strictly increasing
      if (i > 0 && tier.threshold <= group.tiers[i - 1].threshold) {
        throw new Error(
          `Achievement "${group.id}" tier ${tier.tier}: threshold ${tier.threshold} must be greater than previous tier threshold ${group.tiers[i - 1].threshold}`,
        );
      }
    }
  }
}
