/** Available leaderboard categories */
export enum LeaderboardType {
  PLAYTIME = "playtime",
}

/** A single entry in a leaderboard display */
export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  /** Raw value (e.g., seconds) */
  value: string;
  /** Human-readable value (e.g., "24h 30m") */
  formattedValue: string;
}

/** Configuration for a specific leaderboard type */
export interface LeaderboardConfig {
  type: LeaderboardType;
  title: string;
  description: string;
  emoji: string;
  /** Discord channel ID where the leaderboard message is posted */
  channelId: string;
  /** Minecraft server ID to fetch data from */
  serverId: number;
  /** Fetches leaderboard entries from the database */
  fetchData: (serverId: number, limit: number) => Promise<LeaderboardEntry[]>;
  /** Formats a raw numeric value for display */
  formatValue: (value: number) => string;
}

/** Result of a leaderboard refresh operation */
export interface LeaderboardRefreshResult {
  success: boolean;
  type: LeaderboardType;
  entries: LeaderboardEntry[];
  error?: string;
}
