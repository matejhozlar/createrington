import config from "@/config";
import { siteUrl } from "@/config/site-url";
import { buildComponentsMessage, ComponentPresets } from "@/discord/components";
import { Discord } from "@/discord/constants";
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
  return siteUrl("/gallery");
}

export async function announceApproval(
  announcement: ApprovalAnnouncement,
): Promise<AnnouncementRef | null> {
  const channelId = config.gallery.announcementChannelId;
  if (!channelId) return null;

  let message: ReturnType<typeof buildComponentsMessage>;
  try {
    message = buildComponentsMessage(
      ComponentPresets.gallery.approvalAnnouncement({
        authorDiscordId: announcement.authorDiscordId,
        caption: announcement.caption,
        creditNames: announcement.creditNames,
        rewardAmount: announcement.rewardAmount,
        imageUrl: announcement.imageUrl,
        galleryUrl: galleryPageUrl(),
      }),
    );
  } catch (error) {
    logger.error(
      `Gallery: failed to render the announcement for submission #${announcement.submissionId}:`,
      error,
    );
    return null;
  }

  const sent = await Discord.Messages.send({
    channelId,
    components: message.components,
    flags: message.flags,
    allowedMentions: { users: [announcement.authorDiscordId] },
  }).catch((error: unknown) => {
    logger.error(
      `Gallery: failed to announce submission #${announcement.submissionId}:`,
      error,
    );
    return null;
  });

  return sent ? { channelId, messageId: sent.id } : null;
}

export async function deleteAnnouncement(ref: AnnouncementRef): Promise<void> {
  await Discord.Messages.delete(ref).catch((error: unknown) => {
    logger.warn(
      `Gallery: failed to delete announcement ${ref.messageId}:`,
      error,
    );
  });
}

export async function markSourceMessage(
  channelId: string,
  messageId: string,
  outcome: SourceOutcome,
): Promise<void> {
  try {
    const message = await Discord.Messages.fetchMessage({
      channelId,
      messageId,
    });
    await message.reactions.cache.get(GALLERY_INTAKE_REACTION)?.users.remove();
    await message.react(
      outcome === "approved" ? APPROVED_REACTION : REJECTED_REACTION,
    );
  } catch (error) {
    logger.warn(`Gallery: failed to mark source message ${messageId}:`, error);
  }
}
