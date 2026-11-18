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

const HOUR_SECONDS = 60 * 60;

export const PLAYTIME_ROLE_HIERARCHY: PlaytimeRoleRule[] = [
  {
    roleId: Discord.Roles.SHAFT_SCRAPER,
    requiredSeconds: 0,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Shaft Scraper",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [],
    enabled: true,
  },
  {
    roleId: Discord.Roles.COG_CARRIER,
    requiredSeconds: 20 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Cog Carrier",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.SHAFT_SCRAPER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.KINETIC_OPERATOR,
    requiredSeconds: 40 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Kinetic Operator",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.COG_CARRIER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.MECHANICAL_ASSEMBLER,
    requiredSeconds: 60 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Mechanical Assembler",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.KINETIC_OPERATOR],
    enabled: true,
  },
  {
    roleId: Discord.Roles.BRASS_TECHNICIAN,
    requiredSeconds: 100 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Brass Technician",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.MECHANICAL_ASSEMBLER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.STEAM_ENGINEER,
    requiredSeconds: 200 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Steam Engineer",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.BRASS_TECHNICIAN],
    enabled: true,
  },
  {
    roleId: Discord.Roles.FACTORY_OVERSEER,
    requiredSeconds: 300 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Factory Overseer",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.STEAM_ENGINEER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.MASTER_AUTOMATON,
    requiredSeconds: 400 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Master Automaton",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.FACTORY_OVERSEER],
    enabled: true,
  },
  {
    roleId: Discord.Roles.CLOCKWORK_ARCHITECT,
    requiredSeconds: 1000 * HOUR_SECONDS,
    checkInterval: RoleCheckInterval.REALTIME,
    label: "Clockwork Architect",
    conditionType: RoleConditionType.PLAYTIME,
    removesRoles: [Discord.Roles.MASTER_AUTOMATON],
    enabled: true,
  },
];

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

/** Gets every competitive top-1 role rule (playtime, balance, stat records) */
export function getTopRoleRules(): TopRoleRule[] {
  return [
    ...TOP_PLAYTIME_ROLES,
    ...TOP_BALANCE_ROLES,
    ...TOP_RECORD_ROLES,
  ].filter((rule) => rule.enabled !== false);
}

function getAllRoleRules(): (PlaytimeRoleRule | ServerAgeRoleRule)[] {
  return [
    ...PLAYTIME_ROLE_HIERARCHY.filter((rule) => rule.enabled !== false),
    ...SERVER_AGE_ROLE_HIERARCHY.filter((rule) => rule.enabled !== false),
  ];
}

/** Gets role rules that should be checked in realtime */
export function getRealtimeRoleRules(): AnyRoleRule[] {
  return getAllRoleRules().filter(
    (rule) => rule.checkInterval === RoleCheckInterval.REALTIME,
  );
}

/** Gets role rules that should be checked daily */
export function getDailyRoleRules(): AnyRoleRule[] {
  return getAllRoleRules().filter(
    (rule) => rule.checkInterval === RoleCheckInterval.DAILY,
  );
}

export const DEFAULT_NOTIFICATION_CONFIG: RoleNotificationConfig = {
  enabled: true,
  channelId: Discord.Channels.general.HALL_OF_FAME,
  pose: Poses.victory,
};

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

/** Gets notification configuration for a specific role */
export function getNotificationConfig(roleId: string): RoleNotificationConfig {
  return {
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...(ROLE_NOTIFICATION_CONFIGS[roleId] ?? {}),
  };
}
