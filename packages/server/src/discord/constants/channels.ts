import config from "@/config";
import {
  type ToScreamingSnakeCase,
  toScreamingSnakeCase,
} from "./screaming-snake";

const channelsConfig = config.discord.guild.channels;

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

export const DiscordChannelsNamespace = {
  ...DiscordChannels,
} as const;
