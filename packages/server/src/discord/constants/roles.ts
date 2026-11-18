import config from "@/config";

const roles = config.discord.guild.roles;

function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

type ToScreamingSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
    : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
  : S;

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

  mention(roleId: DiscordRoleId): string {
    return `<@&${roleId}>`;
  },
} as const;
