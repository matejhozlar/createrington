import type { KnownPose } from "createrington-skin-api";
import type { DiscordRoleId } from "@/discord/constants";
import type { AppEmojiKey } from "@/discord/emojis";

export enum RoleCheckInterval {
  REALTIME = "realtime",
  DAILY = "daily",
  WEEKLY = "weekly",
}

export enum RoleConditionType {
  PLAYTIME = "playtime",
  BALANCE = "balance",
  SERVER_AGE = "server_age",
  TOP_PLAYTIME = "top_playtime",
  TOP_BALANCE = "top_balance",
  TOP_STAT_RECORDS = "top_stat_records",
  CUSTOM = "custom",
}

export interface RoleAssignmentRule {
  roleId: DiscordRoleId;
  label: string;
  checkInterval: RoleCheckInterval;
  conditionType: RoleConditionType;
  removesRoles?: DiscordRoleId[];
  enabled?: boolean;
}

export interface PlaytimeRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.PLAYTIME;
  requiredSeconds: number;
  serverId?: number;
}

export interface BalanceRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.BALANCE;
  requiredBalance: number;
}

export interface ServerAgeRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.SERVER_AGE;
  requiredDays: number;
}

export interface TopPlaytimeRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.TOP_PLAYTIME;
  gameRankId: string;
  heroPose: KnownPose;
}

export interface TopBalanceRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.TOP_BALANCE;
  gameRankId: string;
  heroPose: KnownPose;
}

export interface TopStatRecordsRoleRule extends RoleAssignmentRule {
  conditionType: RoleConditionType.TOP_STAT_RECORDS;
  gameRankId: string;
  heroPose: KnownPose;
}

export type TopRoleRule =
  TopPlaytimeRoleRule | TopBalanceRoleRule | TopStatRecordsRoleRule;

export type AnyRoleRule =
  | PlaytimeRoleRule
  | BalanceRoleRule
  | ServerAgeRoleRule
  | TopPlaytimeRoleRule
  | TopBalanceRoleRule
  | TopStatRecordsRoleRule;

export interface RoleEligibilityResult {
  rule: AnyRoleRule;
  qualifies: boolean;
  currentValue: number;
  requiredValue: number;
  discordId: string;
}

export interface RoleAssignmentResult {
  success: boolean;
  rule: AnyRoleRule;
  discordId: string;
  assigned: boolean;
  removedRoles?: DiscordRoleId[];
  error?: string;
}

export interface RoleNotificationConfig {
  enabled: boolean;
  channelId?: string;
  pose: KnownPose;
  emoji?: AppEmojiKey;
}

export interface RoleAssignmentNotification {
  discordId: string;
  username: string;
  role: AnyRoleRule;
  roleColor: number;
  currentValue: number;
  requiredValue: number;
  timestamp: Date;
}
