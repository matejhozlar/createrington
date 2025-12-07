/**
 * Represents a guild member join record in the database
 */
export interface GuildMemberJoin {
  /** Unique sequential join number (shown in welcome image) */
  joinNumber: number;
  /** Discord user ID (snowflake) */
  userId: string;
  /** Username at time of join */
  username: string;
  /** Timestamp when user joined */
  joinedAt: Date;
}

/**
 * Database representation (snake_case columns)
 */
export interface GuildMemberJoinRow {
  join_number: number;
  user_id: string;
  username: string;
  joined_at: Date;
}

/**
 * Data required to create a new join record
 */
export interface GuildMemberJoinCreate {
  userId: string;
  username: string;
  joinedAt?: Date;
}
