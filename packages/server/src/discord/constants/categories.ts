import config from "@/config";
import {
  type ToScreamingSnakeCase,
  toScreamingSnakeCase,
} from "./screaming-snake";

const categories = config.discord.guild.categories;

export const DiscordCategories = Object.fromEntries(
  Object.entries(categories).map(([key, value]) => [
    toScreamingSnakeCase(key),
    value,
  ]),
) as {
  [
    K in keyof typeof categories as ToScreamingSnakeCase<K & string>
  ]: (typeof categories)[K];
};

export const DiscordCategoriesNamespace = {
  ...DiscordCategories,
} as const;
