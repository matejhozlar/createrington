import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { getService, Services } from "@/services";
import config from "@/config";
import {
  AttachmentBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

const CATEGORY_CHOICES = [
  { name: "Mined (blocks)", value: "minecraft:mined" },
  { name: "Killed (mobs)", value: "minecraft:killed" },
  { name: "Killed By (deaths)", value: "minecraft:killed_by" },
  { name: "Crafted", value: "minecraft:crafted" },
  { name: "Used (placed/used)", value: "minecraft:used" },
  { name: "Broken (tools)", value: "minecraft:broken" },
  { name: "Picked Up", value: "minecraft:picked_up" },
  { name: "Dropped", value: "minecraft:dropped" },
  { name: "Custom (misc stats)", value: "minecraft:custom" },
];

/**
 * Slash command definition for the top command
 * Shows top 3 players for a given Minecraft stat
 */
export const data = new SlashCommandBuilder()
  .setName("top")
  .setDescription("Show top 3 players for a Minecraft stat")
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("Stat category")
      .setRequired(true)
      .addChoices(...CATEGORY_CHOICES),
  )
  .addStringOption((opt) =>
    opt
      .setName("item")
      .setDescription("Item or entity (e.g. zombie, diamond_ore)")
      .setRequired(true)
      .setAutocomplete(true),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking stats again!",
};

/**
 * Handles autocomplete for the item option
 * Searches available stat items matching the user's typed text
 */
export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused();

  // When empty, search with a broad term to show common items
  const query = focused.length >= 1 ? focused : "minecraft:";
  const results = await Q.player.minecraft.stats.searchItems(query, 25);

  await interaction.respond(
    results.map((item) => ({
      name: item,
      value: item,
    })),
  );
}

/**
 * Executes the top command to generate a leaderboard card
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const category = interaction.options.getString("category", true);
  let item = interaction.options.getString("item", true).trim().toLowerCase();

  // Normalize: add minecraft: prefix if missing and no namespace present
  if (!item.includes(":")) {
    item = `minecraft:${item.replace(/\s+/g, "_")}`;
  }

  await interaction.deferReply();

  try {
    // Verify the stat actually has data
    const results = await Q.player.minecraft.stats.compareItem(
      item,
      [category],
      { limit: 3 },
    );

    if (results.length === 0) {
      const embed = EmbedPresets.error(
        "No Data",
        `No players found with stats for **${item}** in **${category}**.`,
      );
      await interaction.editReply({ embeds: [embed.build()] });
      return;
    }

    // Try Puppeteer screenshot
    let screenshotBuffer: Buffer | null = null;
    try {
      const puppeteer = await getService(Services.PUPPETEER_SERVICE);
      const renderUrl = new URL("/render/top", config.puppeteer.baseUrl);
      renderUrl.searchParams.set("secret", config.puppeteer.secret);
      renderUrl.searchParams.set("category", category);
      renderUrl.searchParams.set("item", item);

      const result = await puppeteer.screenshot({
        url: renderUrl.toString(),
        waitForSelector: "#top-container",
        elementSelector: "#top-container",
        timeout: 15_000,
        viewportWidth: 900,
        viewportHeight: 500,
      });

      screenshotBuffer = result.buffer;
    } catch (err) {
      logger.warn(
        "Puppeteer screenshot failed for /top, falling back to text embed:",
        err,
      );
    }

    // Format display title
    const itemName = item
      .replace(/^minecraft:/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (screenshotBuffer) {
      const safeName = item.replace(/[^a-zA-Z0-9]/g, "_");
      const attachment = new AttachmentBuilder(screenshotBuffer, {
        name: `top_${safeName}.png`,
      });

      const embed = EmbedPresets.info(`Top ${itemName}`).image(
        `attachment://top_${safeName}.png`,
      );

      await interaction.editReply({
        embeds: [embed.build()],
        files: [attachment],
      });
    } else {
      // Text fallback
      const medals = ["🥇", "🥈", "🥉"];
      const leaderboard = results
        .map(
          (r, i) =>
            `${medals[i]} **${r.minecraftUsername}** — ${r.values[0].toLocaleString()}`,
        )
        .join("\n");

      const embed = EmbedPresets.info(`Top ${itemName}`).field(
        category.replace(/^minecraft:/, ""),
        leaderboard,
        false,
      );

      await interaction.editReply({ embeds: [embed.build()] });
    }
  } catch {
    const embed = EmbedPresets.error(
      "Leaderboard Error",
      "Could not fetch stat data.",
    );
    await interaction.editReply({ embeds: [embed.build()] });
  }
}
