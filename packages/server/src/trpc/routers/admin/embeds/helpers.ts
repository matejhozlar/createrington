import { getServiceSync, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import {
  type EmbedData,
  type MessagePayload,
  type PresetKind,
} from "@createrington/shared/api/embed";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import type {
  EditMessageOptions,
  SendMessageOptions,
} from "@/services/discord/message/types";
import {
  buildComponentsV2,
  validateComponentsV2,
  type TopLevelComponent,
} from "./components";

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

export type BuiltMessage =
  | {
      ok: true;
      kind: "embed";
      content?: string;
      embeds?: EmbedBuilder;
      components?: ActionRowBuilder<ButtonBuilder>[];
    }
  | {
      ok: true;
      kind: "components";
      components: TopLevelComponent[];
      flags: number;
    }
  | { ok: false; error: string };

/**
 * Validate a builder payload and produce the discord.js pieces to send/edit.
 * Components V2 messages carry the IS_COMPONENTS_V2 flag and never set
 * content or embeds; classic embeds never set that flag.
 */
export function buildMessage(
  payload: MessagePayload,
  presetId?: number,
): BuiltMessage {
  if (payload.kind === "components") {
    const error = validateComponentsV2(payload.components);
    if (error) return { ok: false, error };
    return {
      ok: true,
      kind: "components",
      components: buildComponentsV2(payload.components),
      flags: MessageFlags.IsComponentsV2,
    };
  }

  const data = payload.embed;
  if (!data.content && !hasEmbedContent(data)) {
    return {
      ok: false,
      error:
        "Message must have content, a title, a description, or at least one field",
    };
  }

  return {
    ok: true,
    kind: "embed",
    content: data.content,
    embeds: buildDiscordEmbed(data),
    components: buildButtons(data, presetId),
  };
}

type BuiltOk = Extract<BuiltMessage, { ok: true }>;

/** Translate a built message into `messageService.send` arguments. */
export function toSendOptions(
  built: BuiltOk,
  channelId: string,
): SendMessageOptions {
  return built.kind === "components"
    ? { channelId, components: built.components, flags: built.flags }
    : {
        channelId,
        content: built.content,
        embeds: built.embeds,
        components: built.components,
      };
}

/**
 * Translate a built message into `messageService.edit` arguments. Classic
 * embeds explicitly clear absent fields; Components V2 omits content/embeds
 * entirely since they cannot coexist with the IS_COMPONENTS_V2 flag.
 */
export function toEditOptions(
  built: BuiltOk,
  channelId: string,
  messageId: string,
): EditMessageOptions {
  return built.kind === "components"
    ? { channelId, messageId, components: built.components, flags: built.flags }
    : {
        channelId,
        messageId,
        content: built.content ?? null,
        embeds: built.embeds ?? null,
        components: built.components ?? null,
      };
}

/** Map a builder payload to the `kind` + `data` columns persisted on a preset. */
export function payloadToStorage(payload: MessagePayload): {
  kind: PresetKind;
  data: Record<string, unknown>;
} {
  return payload.kind === "components"
    ? { kind: "components", data: payload.components }
    : { kind: "embed", data: payload.embed };
}
