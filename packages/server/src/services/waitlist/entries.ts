import { Q } from "@/db";
import { updateProgressEmbed } from "./progress-embed";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type { WaitlistEntry } from "@createrington/shared/db";
import type { WaitlistStatus } from "@createrington/shared/waitlist";

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
  options: { onlyFrom?: WaitlistStatus } = {},
): Promise<boolean> {
  const expired = await Q.waitlist.entry.updateAll(
    { status: "expired", expiredAt: new Date() },
    { id: entryId, status: options.onlyFrom },
  );
  if (expired === 0) return false;

  await updateProgressEmbed(entryId);
  logger.info(`Expired waitlist entry #${entryId}: ${reason}`);
  return true;
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
