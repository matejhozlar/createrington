import { getServiceSync, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { type EmbedData } from "@createrington/shared/api/embed";
import { createRateLimit } from "@/trpc/middleware/rate-limit";

export const embedSendLimit = createRateLimit({
  name: "admin.embeds.send",
  limit: 60,
  windowMs: 60 * 60 * 1000,
  key: (ctx) => ctx.user!.discordId,
});

export function getMessageService(bot: "main" | "web" = "main") {
  const serviceKey =
    bot === "main" ? Services.DISCORD_MAIN_BOT : Services.DISCORD_WEB_BOT;
  const client = getServiceSync(serviceKey);
  return DiscordMessageService.getInstance(client);
}

export function hasEmbedContent(data: EmbedData): boolean {
  return !!(
    data.title ||
    data.description ||
    data.fields.length > 0 ||
    data.author ||
    data.footer ||
    data.imageUrl ||
    data.thumbnailUrl
  );
}

export function buildDiscordEmbed(data: EmbedData): EmbedBuilder | undefined {
  if (!hasEmbedContent(data)) return undefined;

  const embed = new EmbedBuilder();

  if (data.title) embed.setTitle(data.title);
  if (data.description) embed.setDescription(data.description);
  if (data.color !== undefined) embed.setColor(data.color);
  if (data.url) embed.setURL(data.url);
  if (data.footer) embed.setFooter({ text: data.footer });
  if (data.author) {
    embed.setAuthor({
      name: data.author,
      url: data.authorUrl || undefined,
      iconURL: data.authorIconUrl || undefined,
    });
  }
  if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);
  if (data.imageUrl) embed.setImage(data.imageUrl);
  if (data.timestamp) embed.setTimestamp();
  if (data.fields.length > 0) {
    embed.addFields(
      data.fields.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline,
      })),
    );
  }

  return embed;
}

export function buildButtons(
  data: EmbedData,
  presetId?: number,
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const hasLinkButtons = data.buttons && data.buttons.length > 0;
  const hasActionButtons = data.actionButtons && data.actionButtons.length > 0;

  if (!hasLinkButtons && !hasActionButtons) return undefined;

  const totalCount =
    (data.buttons?.length ?? 0) + (data.actionButtons?.length ?? 0);
  if (totalCount > 5) {
    logger.warn(
      `Embed has ${totalCount} buttons (max 5 per ActionRow), truncating`,
    );
  }

  const row = new ActionRowBuilder<ButtonBuilder>();

  if (hasLinkButtons) {
    for (const btn of data.buttons) {
      const button = new ButtonBuilder()
        .setLabel(btn.label)
        .setURL(btn.url)
        .setStyle(ButtonStyle.Link);

      if (btn.emoji) button.setEmoji(btn.emoji);
      row.addComponents(button);
    }
  }

  // Action buttons (require a preset to reference)
  if (hasActionButtons && presetId) {
    for (let i = 0; i < data.actionButtons.length; i++) {
      const btn = data.actionButtons[i];
      const button = new ButtonBuilder()
        .setLabel(btn.label)
        .setCustomId(`embed-action:${presetId}:${i}`)
        .setStyle(ButtonStyle.Primary);

      if (btn.emoji) button.setEmoji(btn.emoji);
      row.addComponents(button);
    }
  }

  return row.components.length > 0 ? [row] : undefined;
}
