import type { Client } from "discord.js";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { buildInviteCache } from "@/discord/bots/main/invites";

export const eventName: EventModule<"clientReady">["eventName"] = "clientReady";
export const once = true;

export async function execute(client: Client): Promise<void> {
  await buildInviteCache(client);
}
