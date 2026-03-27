import { type Client, type GuildBasedChannel, ChannelType } from "discord.js";
import config from "@/config";
import { getService, Services } from "@/services";

/**
 * Converts a Discord name to camelCase.
 * Matches the same logic as the scrape-entities script.
 */
function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-&]/g, "")
    .replace(/&/g, " and ")
    .replace(/[-_\s]+/g, " ")
    .trim()
    .split(" ")
    .map((word, index) => {
      if (index === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

/** Strips dynamic content from serverStats channel names */
function cleanChannelName(name: string, categoryKey: string): string {
  if (categoryKey === "serverStats") {
    return name.split(":")[0].replace(/\d+/g, "").trim();
  }
  return name;
}

/**
 * Fetches all Discord roles, channels, and categories from the live guild
 * using the already-running main bot, then updates the in-memory config.
 *
 * No server restart required — admin tools that read from config.discord.guild
 * will immediately see the new data.
 *
 * @returns Summary of what was fetched
 */
export async function refetchDiscordEntities(): Promise<{
  roles: number;
  channels: number;
  categories: number;
}> {
  const client = (await getService(Services.DISCORD_MAIN_BOT)) as Client<true>;
  const guild = await client.guilds.fetch(config.discord.guild.id);

  await guild.channels.fetch();
  await guild.roles.fetch();

  // Scrape roles
  const roles: Record<string, string> = {};
  const guildRoles = guild.roles.cache
    .filter((role) => !role.managed && role.name !== "@everyone")
    .sort((a, b) => b.position - a.position);

  for (const role of guildRoles.values()) {
    roles[toCamelCase(role.name)] = role.id;
  }

  // Scrape categories
  const categories: Record<string, string> = {};
  const guildCategories = guild.channels.cache.filter(
    (ch): ch is GuildBasedChannel & { type: ChannelType.GuildCategory } =>
      ch.type === ChannelType.GuildCategory,
  );

  for (const category of guildCategories.values()) {
    categories[toCamelCase(category.name)] = category.id;
  }

  // Scrape channels grouped by category
  const channels: Record<string, Record<string, string>> = {};
  const guildChannels = guild.channels.cache.filter(
    (ch): ch is GuildBasedChannel =>
      ch.type === ChannelType.GuildText ||
      ch.type === ChannelType.GuildVoice ||
      ch.type === ChannelType.GuildAnnouncement ||
      ch.type === ChannelType.GuildForum,
  );

  const channelsByCategory = new Map<string, GuildBasedChannel[]>();
  for (const channel of guildChannels.values()) {
    const catId = channel.parentId || "uncategorized";
    if (!channelsByCategory.has(catId)) channelsByCategory.set(catId, []);
    channelsByCategory.get(catId)!.push(channel);
  }

  let channelCount = 0;
  for (const [categoryId, catChannels] of channelsByCategory.entries()) {
    const cat = guild.channels.cache.get(categoryId);
    const categoryKey =
      categoryId === "uncategorized"
        ? "uncategorized"
        : cat
          ? toCamelCase(cat.name)
          : "unknown";

    channels[categoryKey] = {};
    for (const channel of catChannels) {
      const cleanedName = cleanChannelName(channel.name, categoryKey);
      channels[categoryKey][toCamelCase(cleanedName)] = channel.id;
      channelCount++;
    }
  }

  // Update config in-place (readonly at type level but mutable at runtime)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guild_ = config.discord.guild as any;
  guild_.roles = roles;
  guild_.channels = channels;
  guild_.categories = categories;

  logger.info(
    `Refetched Discord entities: ${Object.keys(roles).length} roles, ${channelCount} channels, ${Object.keys(categories).length} categories`,
  );

  return {
    roles: Object.keys(roles).length,
    channels: channelCount,
    categories: Object.keys(categories).length,
  };
}
