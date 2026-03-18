import { Discord } from "@/discord/constants";
import type {
  AnyRoleRule,
  PlaytimeRoleRule,
  RoleNotificationConfig,
  ServerAgeRoleRule,
  TopPlaytimeRoleRule,
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
 * Only one player holds this role at a time — the player with the most
 * total playtime across all servers. Checked daily.
 */
export const TOP_PLAYTIME_ROLES: TopPlaytimeRoleRule[] = [
  {
    roleId: Discord.Roles.THE_SLEEPLESS,
    checkInterval: RoleCheckInterval.DAILY,
    label: "The Sleepless",
    conditionType: RoleConditionType.TOP_PLAYTIME,
    enabled: true,
  },
];

/**
 * Gets all role assignment rules
 *
 * @returns Array of all configured role rules
 */
export function getAllRoleRules(): (PlaytimeRoleRule | ServerAgeRoleRule)[] {
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
 * Gets top playtime role rules (competitive, rank-based)
 *
 * @returns Array of top playtime role rules
 */
export function getTopPlaytimeRoleRules(): TopPlaytimeRoleRule[] {
  return TOP_PLAYTIME_ROLES.filter((rule) => rule.enabled !== false);
}

/**
 * Default notification configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG: RoleNotificationConfig = {
  enabled: true,
  channelId: Discord.Channels.general.HALL_OF_FAME,
  isMilestone: false,
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
    enabled: true,
    emoji: "👋",
    isMilestone: false,
  },
  [Discord.Roles.ADVENTURER]: {
    enabled: true,
    emoji: "🗺️",
    isMilestone: false,
  },
  [Discord.Roles.REGULAR]: {
    enabled: true,
    emoji: "🛡️",
    isMilestone: true,
  },
  [Discord.Roles.VETERAN]: {
    enabled: true,
    emoji: "🏆",
    isMilestone: true,
  },
  [Discord.Roles.LEGEND]: {
    enabled: true,
    emoji: "👑",
    isMilestone: true,
    customMessage:
      "has become a legend of the server after a full year of membership!",
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
    enabled: true,
    emoji: "⛏️",
    isMilestone: false,
  },
  [Discord.Roles.COG_CARRIER]: {
    enabled: true,
    emoji: "⚙️",
    isMilestone: false,
  },
  [Discord.Roles.KINETIC_OPERATOR]: {
    enabled: true,
    emoji: "🔧",
    isMilestone: false,
  },
  [Discord.Roles.MECHANICAL_ASSEMBLER]: {
    enabled: true,
    emoji: "🔩",
    isMilestone: false,
  },
  [Discord.Roles.BRASS_TECHNICIAN]: {
    enabled: true,
    emoji: "🛠️",
    isMilestone: true,
  },
  [Discord.Roles.STEAM_ENGINEER]: {
    enabled: true,
    emoji: "🚂",
    isMilestone: true,
  },
  [Discord.Roles.FACTORY_OVERSEER]: {
    enabled: true,
    emoji: "🏭",
    isMilestone: true,
  },
  [Discord.Roles.MASTER_AUTOMATON]: {
    enabled: true,
    emoji: "🤖",
    isMilestone: true,
  },
  [Discord.Roles.CLOCKWORK_ARCHITECT]: {
    enabled: true,
    emoji: "👑",
    isMilestone: true,
    customMessage:
      "has reached the pinnacle of automation mastery and earned the legendary title of",
  },

  [Discord.Roles.THE_SLEEPLESS]: {
    enabled: true,
    emoji: "👑",
    isMilestone: true,
    customMessage: "has claimed the top spot and earned the legendary title of",
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
  const customConfig = ROLE_NOTIFICATION_CONFIGS[roleId] || {};
  return {
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...customConfig,
    ...SERVER_AGE_NOTIFICATION_CONFIGS,
  };
}
