import { Poses } from "createrington-skin-api";
import { Discord } from "@/discord/constants";
import type {
  AnyRoleRule,
  PlaytimeRoleRule,
  RoleNotificationConfig,
  ServerAgeRoleRule,
  TopPlaytimeRoleRule,
  TopBalanceRoleRule,
  TopRoleRule,
  TopStatRecordsRoleRule,
} from "./types";
import { RoleConditionType, RoleCheckInterval } from "./types";

/**
 * Playtime-based role hierarchy configuration
 *
 * Roles are assigned based on cumulative playtime across all servers
 * When a player qualifies for a higher role, lower roles are automatically removed
 */
export const PLAYTIME_ROLE_HIERARCHY: PlaytimeRoleRule[] = [
  {
    roleId: Discord.Roles.SHAFT_SCRAPER,
    requiredSeconds: 0, // Starting role - everyone gets this
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Shaft Scraper",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [],
    enabled: true,
  },
  {
    roleId: Discord.Roles.COG_CARRIER,
    requiredSeconds: 72000, // 20 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Cog Carrier",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.SHAFT_SCRAPER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.KINETIC_OPERATOR,
    requiredSeconds: 144000, // 40 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Kinetic Operator",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.COG_CARRIER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.MECHANICAL_ASSEMBLER,
    requiredSeconds: 216000, // 60 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Mechanical Assembler",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.KINETIC_OPERATOR],
    enabled: true,
  },
  {
    roleId: Discord.Roles.BRASS_TECHNICIAN,
    requiredSeconds: 360000, // 100 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Brass Technician",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.MECHANICAL_ASSEMBLER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.STEAM_ENGINEER,
    requiredSeconds: 720000, // 200 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Steam Engineer",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.BRASS_TECHNICIAN],
    enabled: true,
  },
  {
    roleId: Discord.Roles.FACTORY_OVERSEER,
    requiredSeconds: 1080000, // 300 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Factory Overseer",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.STEAM_ENGINEER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.MASTER_AUTOMATON,
    requiredSeconds: 1440000, // 400 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Master Automaton",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.FACTORY_OVERSEER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.CLOCKWORK_ARCHITECT,
    requiredSeconds: 3600000, // 1000 hours
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Clockwork Architect",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.MASTER_AUTOMATON],
    enabled: true,
  },
];

/**
 * Server age-based role hierarchy configuration
 *
 * Roles are assigned based on how long a member has been in the Discord server
 * When a player qualifies for a higher role, lower roles are automatically removed
 */
export const SERVER_AGE_ROLE_HIERARCHY: ServerAgeRoleRule[] = [
  {
    roleId: Discord.Roles.NEWCOMER,
    requiredDays: 0,
    checkInterval: RoleCheckInterval.DAILY,
    label: "Newcomer",
    conditionType: RoleConditionType.SERVER_AGE,
    removesRoles: [],
    enabled: true,
  },
  {
    roleId: Discord.Roles.ADVENTURER,
    requiredDays: 30,
    checkInterval: RoleCheckInterval.DAILY,
    label: "Adventurer",
    conditionType: RoleConditionType.SERVER_AGE,
    removesRoles: [Discord.Roles.NEWCOMER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.REGULAR,
    requiredDays: 90,
    checkInterval: RoleCheckInterval.DAILY,
    label: "Regular",
    conditionType: RoleConditionType.SERVER_AGE,
    removesRoles: [Discord.Roles.ADVENTURER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.VETERAN,
    requiredDays: 180,
    checkInterval: RoleCheckInterval.DAILY,
    label: "Veteran",
    conditionType: RoleConditionType.SERVER_AGE,
    removesRoles: [Discord.Roles.REGULAR],
    enabled: true,
  },
  {
    roleId: Discord.Roles.LEGEND,
    requiredDays: 365,
    checkInterval: RoleCheckInterval.DAILY,
    label: "Legend",
    conditionType: RoleConditionType.SERVER_AGE,
    removesRoles: [Discord.Roles.VETERAN],
    enabled: true,
  },
];

/**
 * Top playtime role configuration (competitive, rank-based)
 *
 * Only one player holds this role at a time: the player with the most
 * total playtime across all servers. Checked daily.
 */
export const TOP_PLAYTIME_ROLES: TopPlaytimeRoleRule[] = [
  {
    roleId: Discord.Roles.THE_SLEEPLESS,
    gameRankId: "the_sleepless",
    heroPose: Poses.zombie,
    checkInterval: RoleCheckInterval.DAILY,
    label: "The Sleepless",
    conditionType: RoleConditionType.TOP_PLAYTIME,
    enabled: true,
  },
];

/**
 * Top balance role configuration (competitive, rank-based)
 *
 * Only one player holds this role at a time: the player with the highest
 * in-game balance. Checked daily.
 */
export const TOP_BALANCE_ROLES: TopBalanceRoleRule[] = [
  {
    roleId: Discord.Roles.CAPITALIST,
    gameRankId: "capitalist",
    heroPose: Poses.snagged,
    checkInterval: RoleCheckInterval.DAILY,
    label: "Capitalist",
    conditionType: RoleConditionType.TOP_BALANCE,
    enabled: true,
  },
];

/**
 * Top stat records role configuration (competitive, rank-based)
 *
 * Only one player holds this role at a time: the player who places #1 across
 * the most contested Minecraft stats. Checked daily.
 */
export const TOP_RECORD_ROLES: TopStatRecordsRoleRule[] = [
  {
    roleId: Discord.Roles.THE_UNRIVALED,
    gameRankId: "the_unrivaled",
    heroPose: Poses.ninja,
    checkInterval: RoleCheckInterval.DAILY,
    label: "The Unrivaled",
    conditionType: RoleConditionType.TOP_STAT_RECORDS,
    enabled: true,
  },
];

/**
 * Gets every competitive top-1 role rule (playtime, balance, stat records)
 *
 * @returns Array of enabled top role rules
 */
export function getTopRoleRules(): TopRoleRule[] {
  return [
    ...TOP_PLAYTIME_ROLES,
    ...TOP_BALANCE_ROLES,
    ...TOP_RECORD_ROLES,
  ].filter((rule) => rule.enabled !== false);
}

/**
 * Gets all role assignment rules
 *
 * @returns Array of all configured role rules
 */
function getAllRoleRules(): (PlaytimeRoleRule | ServerAgeRoleRule)[] {
  return [
    ...PLAYTIME_ROLE_HIERARCHY.filter((rule) => rule.enabled !== false),
    ...SERVER_AGE_ROLE_HIERARCHY.filter((rule) => rule.enabled !== false),
  ];
}

/**
 * Gets role rules that should be checked in realtime
 *
 * @returns Array of realtime role rules
 */
export function getRealtimeRoleRules(): AnyRoleRule[] {
  return getAllRoleRules().filter(
    (rule) => rule.checkInterval === RoleCheckInterval.REALTIME,
  );
}

/**
 * Gets role rules that should be checked daily
 *
 * @returns Array of daily role rules
 */
export function getDailyRoleRules(): AnyRoleRule[] {
  return getAllRoleRules().filter(
    (rule) => rule.checkInterval === RoleCheckInterval.DAILY,
  );
}

/**
 * Default notification configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG: RoleNotificationConfig = {
  enabled: true,
  channelId: Discord.Channels.general.HALL_OF_FAME,
  pose: Poses.victory,
};

/**
 * Notification configuration for specific roles
 * Override defaults here for special roles
 */
export const SERVER_AGE_NOTIFICATION_CONFIGS: Record<
  string,
  Partial<RoleNotificationConfig>
> = {
  [Discord.Roles.NEWCOMER]: {
    pose: Poses.wave,
  },
  [Discord.Roles.ADVENTURER]: {
    pose: Poses.sprint,
  },
  [Discord.Roles.REGULAR]: {
    pose: Poses.relaxed,
  },
  [Discord.Roles.VETERAN]: {
    pose: Poses.ponder,
  },
  [Discord.Roles.LEGEND]: {
    pose: Poses.idol,
  },
};

/**
 * Notification configuration for specific roles
 * Override defaults here for special roles
 */
export const ROLE_NOTIFICATION_CONFIGS: Record<
  string,
  Partial<RoleNotificationConfig>
> = {
  [Discord.Roles.SHAFT_SCRAPER]: {
    pose: Poses.idle,
  },
  [Discord.Roles.COG_CARRIER]: {
    pose: Poses.delivery,
  },
  [Discord.Roles.KINETIC_OPERATOR]: {
    pose: Poses.engineer,
  },
  [Discord.Roles.MECHANICAL_ASSEMBLER]: {
    pose: Poses.point,
  },
  [Discord.Roles.BRASS_TECHNICIAN]: {
    pose: Poses.confidence,
  },
  [Discord.Roles.STEAM_ENGINEER]: {
    pose: Poses.cheer,
  },
  [Discord.Roles.FACTORY_OVERSEER]: {
    pose: Poses.crossed,
  },
  [Discord.Roles.MASTER_AUTOMATON]: {
    pose: Poses.idol,
  },
  [Discord.Roles.CLOCKWORK_ARCHITECT]: {
    pose: Poses.victory,
  },

  [Discord.Roles.THE_SLEEPLESS]: {
    pose: Poses.zombie,
    emoji: "the_sleepless",
  },

  [Discord.Roles.CAPITALIST]: {
    pose: Poses.snagged,
    emoji: "capitalist",
  },

  [Discord.Roles.THE_UNRIVALED]: {
    pose: Poses.callout,
    emoji: "the_unrivaled",
  },

  ...SERVER_AGE_NOTIFICATION_CONFIGS,
};

/**
 * Gets notification configuration for a specific role
 *
 * @param roleId - Discord role ID
 * @returns Merged notification configuration
 */
export function getNotificationConfig(roleId: string): RoleNotificationConfig {
  return {
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...(ROLE_NOTIFICATION_CONFIGS[roleId] ?? {}),
  };
}
