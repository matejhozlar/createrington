import { ChannelType, type ForumChannel } from "discord.js";
import config from "@/config";
import { getService, Services } from "@/services";
import { BadRequestError } from "@/app/middleware/error-handler";
import { Q } from "@/db";
import type {
  CurseforgeProject,
  Vote,
  VoteMod,
  VoteModStatus,
} from "@createrington/shared/db";

interface SuggestionAnnouncement extends VoteMod {
  project: Pick<CurseforgeProject, "name" | "primaryAuthor" | "websiteUrl">;
  submitterName: string | null;
}

const STATUS_TAG_NAMES: Record<VoteModStatus, string> = {
  pending: "Suggested",
  approved: "In the pack",
  declined: "Not this time",
  rejected: "Ruled out",
};

export function discordThreadUrl(threadId: string): string {
  return `https://discord.com/channels/${config.discord.guild.id}/${threadId}`;
}

/** Forum channels in the guild, for the admin channel picker. */
export async function listForumChannels(): Promise<
  Array<{ id: string; name: string }>
> {
  const bot = await getService(Services.DISCORD_MAIN_BOT);
  const guild = await bot.guilds.fetch(config.discord.guild.id);
  const channels = await guild.channels.fetch();
  return [...channels.values()]
    .filter((channel) => channel?.type === ChannelType.GuildForum)
    .map((channel) => ({ id: channel!.id, name: channel!.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Throws unless the id resolves to a forum channel the bot can see. */
export async function assertForumChannel(channelId: string): Promise<void> {
  const bot = await getService(Services.DISCORD_MAIN_BOT);
  const channel = await bot.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildForum) {
    throw new BadRequestError(
      "That channel is not a forum channel the bot can access",
    );
  }
}

async function getForum(channelId: string): Promise<ForumChannel | null> {
  const bot = await getService(Services.DISCORD_MAIN_BOT);
  const channel = await bot.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildForum) {
    logger.warn(
      `Workshop forum channel ${channelId} is missing or not a forum`,
    );
    return null;
  }
  return channel;
}

async function ensureStatusTags(
  forum: ForumChannel,
): Promise<Map<string, string>> {
  const wanted = Object.values(STATUS_TAG_NAMES);
  let tags = forum.availableTags;
  const missing = wanted.filter(
    (name) => !tags.some((tag) => tag.name === name),
  );
  if (missing.length > 0) {
    try {
      const updated = await forum.setAvailableTags([
        ...forum.availableTags,
        ...missing.map((name) => ({ name })),
      ]);
      tags = updated.availableTags;
    } catch (error) {
      logger.warn(`Could not create workshop forum tags: ${error}`);
    }
  }
  return new Map(tags.map((tag) => [tag.name, tag.id]));
}

/** Create the suggestion's discussion thread and store its id on the mod row. */
export async function announceSuggestion(
  vote: Vote,
  mod: SuggestionAnnouncement,
): Promise<void> {
  if (!vote.discordForumChannelId || mod.discordThreadId) return;
  try {
    const forum = await getForum(vote.discordForumChannelId);
    if (!forum) return;

    const tags = await ensureStatusTags(forum);
    const tagId = tags.get(STATUS_TAG_NAMES[mod.status]);

    const author = mod.project.primaryAuthor
      ? ` by ${mod.project.primaryAuthor}`
      : "";
    const verb = mod.source === "admin" ? "Added" : "Suggested";
    const note = mod.note ? `: ${mod.note}` : "";
    const lines = [
      `**${mod.project.name}**${author}`,
      `${verb} by **${mod.submitterName ?? "a player"}**${note}`,
    ];
    if (mod.project.websiteUrl) lines.push(mod.project.websiteUrl);

    const thread = await forum.threads.create({
      name: mod.project.name.slice(0, 100),
      message: { content: lines.join("\n") },
      appliedTags: tagId ? [tagId] : [],
      reason: `Workshop suggestion #${mod.id}`,
    });
    await Q.vote.mod.update({ id: mod.id }, { discordThreadId: thread.id });
  } catch (error) {
    logger.warn(
      `Failed to create suggestion thread for mod #${mod.id}: ${error}`,
    );
  }
}

/** Post the review outcome into the suggestion's thread and update its tag. */
export async function announceReview(
  mod: VoteMod,
  status: "approved" | "declined" | "rejected",
  reason?: string | null,
): Promise<void> {
  if (!mod.discordThreadId) return;
  try {
    const bot = await getService(Services.DISCORD_MAIN_BOT);
    const thread = await bot.channels
      .fetch(mod.discordThreadId)
      .catch(() => null);
    if (!thread?.isThread()) return;
    if (thread.archived) await thread.setArchived(false);

    if (thread.parent?.type === ChannelType.GuildForum) {
      const tags = await ensureStatusTags(thread.parent);
      const tagId = tags.get(STATUS_TAG_NAMES[status]);
      if (tagId) await thread.setAppliedTags([tagId]);
    }

    const content =
      status === "approved"
        ? "✅ **In the pack!** The team approved this suggestion."
        : status === "declined"
          ? `**Not this time.**${reason ? ` ${reason}` : ""} The slot is free again.`
          : `🚫 **Ruled out by the team.**${reason ? ` ${reason}` : ""}`;
    await thread.send(content);
  } catch (error) {
    logger.warn(`Failed to post review outcome for mod #${mod.id}: ${error}`);
  }
}

/** Note the withdrawal in the suggestion's thread and archive it. */
export async function announceWithdrawal(mod: VoteMod): Promise<void> {
  if (!mod.discordThreadId) return;
  try {
    const bot = await getService(Services.DISCORD_MAIN_BOT);
    const thread = await bot.channels
      .fetch(mod.discordThreadId)
      .catch(() => null);
    if (!thread?.isThread() || thread.archived) return;
    await thread.send("Withdrawn by the suggester.");
    await thread.setArchived(true);
  } catch (error) {
    logger.warn(`Failed to archive withdrawn suggestion #${mod.id}: ${error}`);
  }
}
