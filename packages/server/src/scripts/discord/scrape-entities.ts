import "@/logger.global";
import { Client, GatewayIntentBits } from "discord.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@/config/env/env.config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface DiscordEntities {
  roles: Record<string, string>;
  channels: Record<string, Record<string, string>>;
  categories: Record<string, string>;
}

/**
 * Ensure directory exists, create if doesn't
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Convert a Discord name to camelCase
 * Examples:
 *      "admin-chat" -> "adminChat"
 *      "Cogs & Steam" -> "cogsAndSteam"
 *      "Test Server" -> "testServer"
 *      "Admin" -> "admin"
 */
function toCamelCase(str: string): string {
  return (
    str
      .toLowerCase()
      // Remove special characters except spaces, hyphens, and ampersand
      .replace(/[^\w\s-&]/g, "")
      // Replace & with " and " (with spaces to separate it as a word)
      .replace(/&/g, " and ")
      // Replace spaces and hyphens with single space
      .replace(/[-_\s]+/g, " ")
      // Trim and split into words
      .trim()
      .split(" ")
      // Capitalize first letter of each word except first
      .map((word, index) => {
        if (index === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join("")
  );
}

/**
 * Clean channel name by removing dynamic content (numbers, special patterns)
 * Especially useful for serverStats channels that get updated at runtime
 * Examples:
 *      "bots: 2" -> "bots"
 *      "members: 150" -> "members"
 *      "all-members: 200" -> "all-members"
 */
function cleanChannelName(name: string, categoryKey: string): string {
  // For serverStats category, strip everything after colon or numbers
  if (categoryKey === "serverStats") {
    return name
      .split(":")[0] // Remove everything after colon
      .replace(/\d+/g, "") // Remove any numbers
      .trim();
  }
  return name;
}

/**
 * Generate TypeScript type definitions from entities
 */
function generateTypeDefinitions(entities: DiscordEntities): string {
  const lines: string[] = [];

  // Generate MemberRolesConfig interface
  lines.push("interface MemberRolesConfig {");
  for (const [key] of Object.entries(entities.roles)) {
    lines.push(`  readonly ${key}: string;`);
  }
  lines.push("}\n");

  // Generate ChannelConfig interface
  lines.push("interface ChannelConfig {");
  for (const [categoryKey, channels] of Object.entries(entities.channels)) {
    lines.push(`  readonly ${categoryKey}: {`);
    for (const [channelKey] of Object.entries(channels)) {
      lines.push(`    readonly ${channelKey}: string;`);
    }
    lines.push("  };\n");
  }
  lines.push("}\n");

  // Generate CategoriesConfig interface
  lines.push("interface CategoriesConfig {");
  for (const [key] of Object.entries(entities.categories)) {
    lines.push(`  readonly ${key}: string;`);
  }
  lines.push("}\n");

  // Export all interfaces
  lines.push(
    "export type { MemberRolesConfig, ChannelConfig, CategoriesConfig };",
  );

  return lines.join("\n");
}

/**
 * Scrape all Discord entities from the guild
 */
async function scrapeDiscordEntities(): Promise<void> {
  console.log("Initializing Discord bot...\n");

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    // Login to Discord
    await client.login(env.DISCORD_MAIN_BOT_TOKEN);
    console.log(`✓ Logged in as ${client.user?.tag}\n`);

    // Get the guild
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    console.log(`✓ Connected to guild: ${guild.name}\n`);

    // Fetch all channels, roles, and categories
    await guild.channels.fetch();
    await guild.roles.fetch();

    const entities: DiscordEntities = {
      roles: {},
      channels: {},
      categories: {},
    };

    // ========================================================================
    // SCRAPE ROLES
    // ========================================================================
    console.log("Scraping roles...");
    const roles = guild.roles.cache
      .filter((role) => !role.managed && role.name !== "@everyone")
      .sort((a, b) => b.position - a.position);

    for (const role of roles.values()) {
      const key = toCamelCase(role.name);
      entities.roles[key] = role.id;
      console.log(`   ✓ ${role.name} -> ${key}`);
    }

    // ========================================================================
    // SCRAPE CATEGORIES
    // ========================================================================
    console.log("\nScraping categories...");
    const categories = guild.channels.cache.filter(
      (channel) => channel.type === 4, // ChannelType.GuildCategory
    );

    for (const category of categories.values()) {
      const key = toCamelCase(category.name);
      entities.categories[key] = category.id;
      console.log(`   ✓ ${category.name} -> ${key}`);
    }

    // ========================================================================
    // SCRAPE CHANNELS (organized by category)
    // ========================================================================
    console.log("\nScraping channels...");

    // Group channels by category
    const channelsByCategory = new Map<string, any[]>();

    // Include text (0), voice (2), and announcement (5) channels
    const channels = guild.channels.cache.filter(
      (channel) =>
        channel.type === 0 || channel.type === 2 || channel.type === 5,
    );

    for (const channel of channels.values()) {
      const categoryId = channel.parentId || "uncategorized";
      if (!channelsByCategory.has(categoryId)) {
        channelsByCategory.set(categoryId, []);
      }
      channelsByCategory.get(categoryId)!.push(channel);
    }

    // Organize channels by category
    for (const [categoryId, channels] of channelsByCategory.entries()) {
      let categoryKey: string;

      if (categoryId === "uncategorized") {
        categoryKey = "uncategorized";
      } else {
        const category = guild.channels.cache.get(categoryId);
        categoryKey = category ? toCamelCase(category.name) : "unknown";
      }

      entities.channels[categoryKey] = {};

      for (const channel of channels) {
        // Clean the channel name (especially for serverStats)
        const cleanedName = cleanChannelName(channel.name, categoryKey);
        const channelKey = toCamelCase(cleanedName);
        const channelType = channel.type === 0 ? "text" : "voice";

        entities.channels[categoryKey][channelKey] = channel.id;

        // Show what was cleaned if applicable
        const cleanedIndicator =
          cleanedName !== channel.name
            ? ` (cleaned from "${channel.name}")`
            : "";
        console.log(
          `   ✓ ${channelType === "voice" ? "🔊" : "#"}${cleanedName} -> ${categoryKey}.${channelKey}${cleanedIndicator}`,
        );
      }
    }

    // ========================================================================
    // WRITE FILES
    // ========================================================================
    const outputDir = path.resolve(__dirname, "../../config");
    await ensureDir(outputDir);

    // Write JSON file
    const jsonPath = path.join(outputDir, "discord-entities.json");
    const jsonContent = JSON.stringify(entities, null, 2);
    await fs.writeFile(jsonPath, jsonContent, "utf-8");

    // Write TypeScript types file
    const typesPath = path.join(outputDir, "discord.types.ts");
    const typesContent = generateTypeDefinitions(entities);
    await fs.writeFile(typesPath, typesContent, "utf-8");

    console.log(`\nSuccessfully scraped Discord entities!\n`);
    console.log(`JSON file:  ${jsonPath}`);
    console.log(`Types file: ${typesPath}`);
    console.log(`\nStatistics:`);
    console.log(`   Roles:      ${Object.keys(entities.roles).length}`);
    console.log(`   Categories: ${Object.keys(entities.categories).length}`);
    console.log(
      `   Channels:   ${Object.values(entities.channels).reduce((sum, cat) => sum + Object.keys(cat).length, 0)}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("\nFailed to scrape Discord entities:");
    console.error(error);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

scrapeDiscordEntities();
