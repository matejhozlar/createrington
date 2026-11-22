import { Q } from "@/db";
import { updateProgressEmbed } from "./progress-embed";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type { WaitlistEntry } from "@createrington/shared/db";

export const PROMOTION_TTL_DAYS = 7;

export async function notifyAdmins(entry: WaitlistEntry): Promise<void> {
  try {
    const { embed, components } = EmbedPresets.waitlist.queueNotification({
      id: entry.id,
      discordId: entry.discordId,
      discordUsername: entry.discordUsername,
      status: entry.status,
    });

    const message = await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: embed.setTimestamp(),
      components,
    });

    await Q.waitlist.entry.update(
      { id: entry.id },
      { adminMessageId: message.id },
    );
  } catch (error) {
    logger.error("Failed to notify admins about waitlist entry:", error);
  }
}

export async function expireEntry(
  entryId: number,
  reason: string,
): Promise<void> {
  await Q.waitlist.entry.update(
    { id: entryId },
    { status: "expired", expiredAt: new Date() },
  );
  await updateProgressEmbed(entryId);
  logger.info(`Expired waitlist entry #${entryId}: ${reason}`);
}

export async function requeueEntry(
  entryId: number,
  changes: Partial<WaitlistEntry> = {},
): Promise<void> {
  await Q.waitlist.entry.update(
    { id: entryId },
    {
      status: "queued",
      queuedAt: new Date(),
      promotedAt: null,
      promotedBy: null,
      ...changes,
    },
  );
  await updateProgressEmbed(entryId);
}
