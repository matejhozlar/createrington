import { ChannelType, type ForumChannel } from "discord.js";
import config from "@/config";
import { getService, Services } from "@/services";
import { BadRequestError } from "@/app/middleware/error-handler";
import { Discord } from "@/discord/constants";
import { Q } from "@/db";
import type {
  CurseforgeProject,
  Vote,
  VoteMod,
  VoteModStatus,
} from "@createrington/shared/db";

interface SuggestionAnnouncement extends VoteMod {
  project: Pick<CurseforgeProject, "name" | "primaryAuthor" | "websiteUrl">;
}

const STATUS_TAGS = {
  pending: { name: "Suggested", emoji: "💡" },
  approved: { name: "In the pack", emoji: "✅" },
  rejected: { name: "Banned", emoji: "🚫" },
} as const;

function tagNameFor(status: VoteModStatus): string | null {
  if (status === "pending" || status === "approved" || status === "rejected") {
    return STATUS_TAGS[status].name;
  }
  return null;
}

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
  const wanted = Object.values(STATUS_TAGS);
  let tags = forum.availableTags;
  const missing = wanted.filter(
    (tag) => !tags.some((existing) => existing.name === tag.name),
  );
  if (missing.length > 0) {
    try {
      const updated = await forum.setAvailableTags([
        ...forum.availableTags,
        ...missing.map((tag) => ({
          name: tag.name,
          emoji: { id: null, name: tag.emoji },
        })),
      ]);
      tags = updated.availableTags;
    } catch (error) {
      logger.warn(`Could not create workshop forum tags: ${error}`);
    }
  }
  return new Map(tags.map((tag) => [tag.name, tag.id]));
}

async function removeThread(threadId: string): Promise<void> {
  const bot = await getService(Services.DISCORD_MAIN_BOT);
  const thread = await bot.channels.fetch(threadId).catch(() => null);
  if (!thread?.isThread()) return;
  try {
    await thread.delete();
  } catch (error) {
    logger.warn(`Could not delete thread ${threadId}, archiving: ${error}`);
    await thread.setArchived(true).catch(() => {});
  }
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
    const tagName = tagNameFor(mod.status);
    const tagId = tagName ? tags.get(tagName) : undefined;

    const author = mod.project.primaryAuthor
      ? ` by ${mod.project.primaryAuthor}`
      : "";
    const verb = mod.source === "admin" ? "Added" : "Suggested";
    const note = mod.note ? `: ${mod.note}` : "";
    const lines = [
      `**${mod.project.name}**${author}`,
      `${verb} by ${Discord.Users.mention(mod.submittedBy)}${note}`,
    ];
    if (mod.project.websiteUrl) lines.push(mod.project.websiteUrl);

    const thread = await forum.threads.create({
      name: mod.project.name.slice(0, 100),
      message: {
        content: lines.join("\n"),
        allowedMentions: { users: [mod.submittedBy] },
      },
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

/**
 * Reflect a review outcome on the suggestion's thread. Approvals post and
 * retag, bans post the reason and archive the thread as a record, declines
 * delete the thread entirely so the forum only holds live suggestions.
 */
export async function announceReview(
  mod: VoteMod,
  status: "approved" | "declined" | "rejected",
  reason?: string | null,
): Promise<void> {
  if (!mod.discordThreadId) return;
  try {
    if (status === "declined") {
      await removeThread(mod.discordThreadId);
      await Q.vote.mod.update({ id: mod.id }, { discordThreadId: null });
      return;
    }

    const bot = await getService(Services.DISCORD_MAIN_BOT);
    const thread = await bot.channels
      .fetch(mod.discordThreadId)
      .catch(() => null);
    if (!thread?.isThread()) {
      await Q.vote.mod.update({ id: mod.id }, { discordThreadId: null });
      return;
    }
    if (thread.archived) await thread.setArchived(false);

    if (thread.parent?.type === ChannelType.GuildForum) {
      const tags = await ensureStatusTags(thread.parent);
      const tagName = tagNameFor(status);
      const tagId = tagName ? tags.get(tagName) : undefined;
      if (tagId) await thread.setAppliedTags([tagId]);
    }

    const content =
      status === "approved"
        ? "✅ **In the pack!** The team approved this suggestion."
        : `🚫 **Banned by the team.**${reason ? ` ${reason}` : ""}`;
    await thread.send(content);
    if (status === "rejected") await thread.setArchived(true);
  } catch (error) {
    logger.warn(`Failed to post review outcome for mod #${mod.id}: ${error}`);
  }
}

/** Delete the withdrawn suggestion's thread. */
export async function announceWithdrawal(mod: VoteMod): Promise<void> {
  if (!mod.discordThreadId) return;
  try {
    await removeThread(mod.discordThreadId);
  } catch (error) {
    logger.warn(
      `Failed to remove withdrawn suggestion thread #${mod.id}: ${error}`,
    );
  }
}

/** Clears stored thread ids whose Discord thread no longer exists. */
export async function clearDanglingThreadIds(mods: VoteMod[]): Promise<void> {
  const withThread = mods.filter((mod) => mod.discordThreadId);
  if (withThread.length === 0) return;
  try {
    const bot = await getService(Services.DISCORD_MAIN_BOT);
    for (const mod of withThread) {
      const thread = await bot.channels
        .fetch(mod.discordThreadId!)
        .catch(() => null);
      if (!thread?.isThread()) {
        await Q.vote.mod.update({ id: mod.id }, { discordThreadId: null });
      }
    }
  } catch (error) {
    logger.warn(`Workshop thread id cleanup failed: ${error}`);
  }
}
