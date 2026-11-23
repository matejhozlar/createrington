export enum LeaderboardType {
  PLAYTIME = "playtime",
  NET_WORTH = "net_worth",
  RECORDS = "records",
}

export const LEADERBOARD_ENTRY_LIMIT = 8;

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  playerUuid: string;
  value: string;
  formattedValue: string;
  subtitle?: string;
}

export interface LeaderboardConfig {
  type: LeaderboardType;
  title: string;
  description: string;
  emoji: string;
  titleImageUrl?: string;
  channelId: string;
  serverId?: number;
  limit: number;
  fetchData: (serverId: number, limit: number) => Promise<LeaderboardEntry[]>;
  formatValue: (value: number) => string;
}

export interface LeaderboardRefreshResult {
  success: boolean;
  type: LeaderboardType;
  entries: LeaderboardEntry[];
  error?: string;
}
