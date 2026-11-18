export interface ServerStatsConfig {
  guildId: string;
  membersChannelId?: string;
  botsChannelId?: string;
  totalMembersChannelId?: string;
  botCount: number;
  refreshIntervalMs: number;
}

export interface ServerStats {
  members: number;
  bots: number;
  total: number;
}
