import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { lookupMember } from "@/services/waitlist/discord-lookup";

export interface Departure {
  id: number;
  discordId: string;
  minecraftUuid: string;
  minecraftUsername: string;
  departedAt: Date;
  notificationMessageId: string | null;
}

export type CancelReason = "returned" | "relinked";

export type DepartureCheck =
  | { action: "delete" }
  | { action: "cancel"; reason: CancelReason }
  | { action: "unavailable" };

export async function checkDeparture(
  departure: Departure,
): Promise<DepartureCheck> {
  const player = await Q.player.find({
    minecraftUuid: departure.minecraftUuid,
  });
  if (player && player.discordId !== departure.discordId) {
    return { action: "cancel", reason: "relinked" };
  }

  const lookup = await lookupMember(departure.discordId);
  if (lookup.state === "found") return { action: "cancel", reason: "returned" };
  if (lookup.state === "unavailable") return { action: "unavailable" };
  return { action: "delete" };
}

export async function cancelDeparture(
  departure: Departure,
  reason: CancelReason,
): Promise<void> {
  const cancelledAt = new Date();

  await Q.discord.guild.member.leave.update(
    { id: departure.id },
    { deletedAt: cancelledAt },
  );

  logger.info(
    `Cancelled departure record #${departure.id} for ${departure.minecraftUsername} (${reason})`,
  );

  if (!departure.notificationMessageId) return;

  const embed =
    reason === "returned"
      ? EmbedPresets.departed.returned({
          minecraftUsername: departure.minecraftUsername,
          departedAt: departure.departedAt,
          returnedAt: cancelledAt,
        })
      : EmbedPresets.departed.relinked({
          minecraftUsername: departure.minecraftUsername,
          departedAt: departure.departedAt,
          cancelledAt,
        });

  try {
    await Discord.Messages.edit({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      messageId: departure.notificationMessageId,
      embeds: embed.build(),
      components: null,
    });
  } catch (error) {
    logger.warn(
      `Could not update departure notification for ${departure.minecraftUsername}:`,
      error,
    );
  }
}
