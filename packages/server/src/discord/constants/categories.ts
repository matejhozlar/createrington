import config from "@/config";

const categories = config.discord.guild.categories;

function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

type ToScreamingSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
    : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
  : S;

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
