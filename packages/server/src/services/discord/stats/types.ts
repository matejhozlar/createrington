/**
 * Configuration for server statistics tracking
 */
export interface ServerStatsConfig {
  /** Discord guild ID to track */
  guildId: string;
  /** Channel ID for members count */
  membersChannelId?: string;
  /** Channel ID for bots count */
  botsChannelId?: string;
  /** Channel ID for total members count */
  totalMembersChannelId?: string;
  /** Fixed bot count rendered in the bots channel */
  botCount: number;
  /** Periodic refresh interval in milliseconds */
  refreshIntervalMs: number;
}

/**
 * Server statistics snapshot
 */
export interface ServerStats {
  members: number;
  bots: number;
  total: number;
}
