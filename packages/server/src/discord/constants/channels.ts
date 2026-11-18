import config from "@/config";

const channelsConfig = config.discord.guild.channels;

function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

type ToScreamingSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
    : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
  : S;

type TransformChannels<T> = {
  [K in keyof T]: T[K] extends string
    ? T[K]
    : {
        [P in keyof T[K] as ToScreamingSnakeCase<P & string>]: T[K][P];
      };
};

const DiscordChannels = Object.fromEntries(
  Object.entries(channelsConfig).map(
    ([category, channels]: [string, string | Record<string, string>]) => [
      category,
      typeof channels === "string"
        ? channels
        : Object.fromEntries(
            Object.entries(channels).map(([key, value]) => [
              toScreamingSnakeCase(key),
              value,
            ]),
          ),
    ],
  ),
) as TransformChannels<typeof channelsConfig>;

export type DiscordChannelId = string;

export const DiscordChannelsNamespace = {
  ...DiscordChannels,

  mention(channelId: DiscordChannelId): string {
    return `<#${channelId}>`;
  },
} as const;
