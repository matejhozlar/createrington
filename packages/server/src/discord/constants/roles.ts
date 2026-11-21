import config from "@/config";
import {
  type ToScreamingSnakeCase,
  toScreamingSnakeCase,
} from "./screaming-snake";

const roles = config.discord.guild.roles;

const DiscordRoles = Object.fromEntries(
  Object.entries(roles).map(([key, value]) => [
    toScreamingSnakeCase(key),
    value,
  ]),
) as {
  [
    K in keyof typeof roles as ToScreamingSnakeCase<K & string>
  ]: (typeof roles)[K];
};

export type DiscordRoleId = (typeof DiscordRoles)[keyof typeof DiscordRoles];

export const DiscordRolesNamespace = {
  ...DiscordRoles,
} as const;
