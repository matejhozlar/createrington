import type { DiscordRoleId } from "@/discord/constants";

/**
 * Defines when role eligibility should be checked
 */
export enum RoleCheckInterval {
  /** Check immediately when relevant events occur (e.g., session end) */
  REALTIME = "realtime",
  /** Check once per day at a scheduled time */
  DAILY = "daily",
  /** Check once per week */
  WEEKLY = "weekly",
}

/**
 * Types of conditions that can trigger role assignments
 */
export enum RoleConditionType {
  PLAYTIME = "playtime",
  BALANCE = "balance",
  SERVER_AGE = "server_age",
  TOP_PLAYTIME = "top_playtime",
  TOP_CRYPTO_NETWORTH = "top_crypto_networth",
  CUSTOM = "custom",
}

/**
 * Base configuration for a role assignment rule
 */
export interface RoleAssignmentRule {
  /** Discord role ID to assign */
  roleId: DiscordRoleId;
  /** Human-readable label for the role */
  label: string;
  /** When to check if player qualifies for this role */
  checkInterval: RoleCheckInterval;
  /** Type of condition (playtime, balance, etc.) */
  conditionType: RoleConditionType;
  /** Roles to remove when this role is assigned (for hierarchy) */
  removesRoles?: DiscordRoleId[];
  /** Whether this rule is currently active */
  enabled?: boolean;
}

/**
 * Playtime-based role assignment rule
 */
export interface PlaytimeRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.PLAYTIME;
  /** Minimum total playtime in seconds required */
  requiredSeconds: number;
  /** Optional: Server ID to check playtime on (defaults to all servers) */
  serverId?: number;
}

/**
 * Balance-based role assignment rule
 */
export interface BalanceRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.BALANCE;
  /** Minimum balance required */
  requiredBalance: number;
}

/**
 * Server age-based role assignment rule
 *
 * Assigns roles based on how long a member has been in the Discord server
 */
export interface ServerAgeRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.SERVER_AGE;
  /** Minimum required number of days in the Discord server required */
  requiredDays: number;
}

/**
 * Top playtime-based role assignment rule (competitive, rank-based)
 *
 * Assigned to the single player with the most total playtime across all servers.
 * Only one player holds this role at a time.
 */
export interface TopPlaytimeRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.TOP_PLAYTIME;
}

/**
 * Top crypto networth role assignment rule (competitive, rank-based)
 *
 * Assigned to the single player with the highest crypto portfolio value.
 * Only one player holds this role at a time.
 */
export interface TopCryptoNetworthRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.TOP_CRYPTO_NETWORTH;
}

/**
 * Union type of all possible rule types
 */
export type AnyRoleRule =
  | PlaytimeRoleRule
  | BalanceRoleRule
  | ServerAgeRoleRule
  | TopPlaytimeRoleRule
  | TopCryptoNetworthRoleRule;

/**
 * Result of checking a player's eligibility for a role
 */
export interface RoleEligibilityResult {
  /** The rule that was checked */
  rule: AnyRoleRule;
  /** Whether the player qualifies for the role */
  qualifies: boolean;
  /** Current value (e.g., current playtime in seconds) */
  currentValue: number;
  /** Required value (e.g., required playtime in seconds) */
  requiredValue: number;
  /** Player's Discord ID */
  discordId: string;
}

/**
 * Result of a role assignment operation
 */
export interface RoleAssignmentResult {
  /** Whether the assignment was successful */
  success: boolean;
  /** The rule that was processed */
  rule: AnyRoleRule;
  /** Discord ID of the player */
  discordId: string;
  /** Whether the role was assigned (true) or removed (false) */
  assigned: boolean;
  /** Roles that were removed due to hierarchy */
  removedRoles?: DiscordRoleId[];
  /** Error message if assignment failed */
  error?: string;
}

/**
 * Configuration for role assignment notifications
 */
export interface RoleNotificationConfig {
  /** Whether to send notifications for this role */
  enabled: boolean;
  /** Channel ID to send notifications to */
  channelId?: string;
  /** Custom message template (optional) */
  customMessage?: string;
  /** Whether this is a "milestone" role (gets special treatment) */
  isMilestone?: boolean;
  /** Custom emoji for this role (optional) */
  emoji?: string;
}

/**
 * Data for a role assignment notification
 */
export interface RoleAssignmentNotification {
  /** Discord ID of the player */
  discordId: string;
  /** Username of the player */
  username: string;
  /** The role that was assigned */
  role: AnyRoleRule;
  /** Current value that qualified them (e.g. playtime in seconds) */
  currentValue: number;
  /** Required value for the role */
  requiredValue: number;
  /** Previous role that was removed (if any) */
  previousRole?: AnyRoleRule;
  /** Timestamp of the assignment */
  timestamp: Date;
}
