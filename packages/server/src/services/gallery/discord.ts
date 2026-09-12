import config from "@/config";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import { GALLERY_INTAKE_REACTION } from "./intake";

export interface ApprovalAnnouncement {
  submissionId: number;
  authorDiscordId: string;
  caption: string | null;
  creditNames: string[];
  rewardAmount: number;
  imageUrl: string;
}

export interface AnnouncementRef {
  channelId: string;
  messageId: string;
}

export type SourceOutcome = "approved" | "rejected";

const APPROVED_REACTION = "✅";
const REJECTED_REACTION = "❌";

export function galleryPageUrl(): string {
  return `${config.meta.links.website}/gallery`;
}

export async function announceApproval(
  announcement: ApprovalAnnouncement,
): Promise<AnnouncementRef | null> {
  const channelId = config.gallery.announcementChannelId;
  if (!channelId) return null;

  const galleryUrl = galleryPageUrl();
  const embed = EmbedPresets.gallery.approvalAnnouncement({
    authorDiscordId: announcement.authorDiscordId,
    caption: announcement.caption,
    creditNames: announcement.creditNames,
    rewardAmount: announcement.rewardAmount,
    imageUrl: announcement.imageUrl,
    galleryUrl,
  });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ButtonPresets.gallery.remove(announcement.submissionId),
    ButtonPresets.gallery.open(galleryUrl),
  );

  const result = await Discord.Messages.send({
    channelId,
    embeds: embed.build(),
    components: [row],
    allowedMentions: { users: [announcement.authorDiscordId] },
  });

  if (!result.success || !result.messageId) {
    logger.error(
      `Gallery: failed to announce submission #${announcement.submissionId}: ${result.error ?? "unknown error"}`,
    );
    return null;
  }

  return { channelId, messageId: result.messageId };
}

export async function deleteAnnouncement(ref: AnnouncementRef): Promise<void> {
  const result = await Discord.Messages.delete(ref);
  if (!result.success) {
    logger.warn(
      `Gallery: failed to delete announcement ${ref.messageId}: ${result.error ?? "unknown error"}`,
    );
  }
}

export async function markSourceMessage(
  channelId: string,
  messageId: string,
  outcome: SourceOutcome,
): Promise<void> {
  try {
    const result = await Discord.Messages.fetchMessage({
      channelId,
      messageId,
    });
    if (!result.success) return;

    const { message } = result;
    await message.reactions.cache.get(GALLERY_INTAKE_REACTION)?.users.remove();
    await message.react(
      outcome === "approved" ? APPROVED_REACTION : REJECTED_REACTION,
    );
  } catch (error) {
    logger.warn(`Gallery: failed to mark source message ${messageId}:`, error);
  }
}
