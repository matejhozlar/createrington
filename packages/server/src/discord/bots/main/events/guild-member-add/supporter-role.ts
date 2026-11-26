import type { Client, GuildMember } from "discord.js";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { getOptionalService, Services } from "@/services";

export const eventName: EventModule<"guildMemberAdd">["eventName"] =
  "guildMemberAdd";

export const prodOnly = true;

export async function execute(
  _client: Client,
  member: GuildMember,
): Promise<void> {
  const donations = await getOptionalService(Services.DONATION_SERVICE);
  await donations?.restoreSupporterRole(member);
}
