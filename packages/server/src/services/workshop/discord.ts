import {
  ChannelType,
  DiscordAPIError,
  RESTJSONErrorCodes,
  type AnyThreadChannel,
  type ForumChannel,
} from "discord.js";
import config from "@/config";
import { getService, Services } from "@/services";
import { BadRequestError } from "@/app/middleware/error-handler";
import { Discord } from "@/discord/constants";
import { Q } from "@/db";
import type {
  CurseforgeProject,
  Workshop,
  WorkshopMod,
  WorkshopModRejectReason,
  WorkshopModStatus,
} from "@createrington/shared/db";
import { WORKSHOP_MOD_REJECT_REASON_LABELS } from "@createrington/shared/workshop";

interface SuggestionAnnouncement extends WorkshopMod {
  project: Pick<CurseforgeProject, "name" | "primaryAuthor" | "websiteUrl">;
}

const STATUS_TAGS = {
  pending: { name: "Suggested", emoji: "💡" },
  approved: { name: "Approved", emoji: "✅" },
  testing: { name: "In testing", emoji: "🧪" },
  next_update: { name: "Coming next update", emoji: "📦" },
  in_pack: { name: "In the pack", emoji: "🎉" },
} as const;

const REVIEW_MESSAGES: Record<
  Exclude<WorkshopModStatus, "pending" | "rejected">,
  string
> = {
  approved: "✅ **Approved!** The team wants this one, next stop: testing.",
  testing: "🧪 **In testing.** The team is trying this mod out.",
  next_update:
    "📦 **Coming next update!** This mod passed testing and ships with the next pack update.",
  in_pack: "🎉 **In the pack!** This mod shipped with the latest pack update.",
};

const PACK_DROP_OUT_MESSAGE =
  "↩️ **Dropped from the latest pack update.** Back to coming next update while the team looks into it.";

const REJECT_REASON_TAGS: Record<
  WorkshopModRejectReason,
  { name: string; emoji: string }
> = {
  on_hold: { name: "On hold", emoji: "⏸️" },
  incompatible: { name: "Incompatible", emoji: "⚠️" },
  covered_by_other_mod: { name: "Already covered", emoji: "🔁" },
  not_a_good_fit: { name: "Not a good fit", emoji: "🚫" },
};

const MANAGED_TAG_NAMES = new Set(
  [...Object.values(STATUS_TAGS), ...Object.values(REJECT_REASON_TAGS)].map(
    (tag) => tag.name,
  ),
);

const LIVE_MOD_STATUSES: WorkshopModStatus[] = [
  "pending",
  "approved",
  "testing",
  "next_update",
  "in_pack",
];

const HEAL_THREAD_CREATE_CAP = 5;

type ThreadLookup =
  | { state: "found"; thread: AnyThreadChannel }
  | { state: "gone" }
  | { state: "unavailable" };

function tagNameFor(status: WorkshopModStatus): string | null {
  return status === "rejected" ? null : STATUS_TAGS[status].name;
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
  const wanted = [
    ...Object.values(STATUS_TAGS),
    ...Object.values(REJECT_REASON_TAGS),
  ];
  let tags = forum.availableTags;
  const missing = wanted.filter(
    (tag) => !tags.some((existing) => existing.name === tag.name),
  );
  if (missing.length > 0) {
    if (forum.availableTags.length + missing.length > 20) {
      logger.warn(
        `Forum ${forum.id} is at Discord's 20-tag cap, workshop tags skipped`,
      );
    } else {
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
  }
  return new Map(tags.map((tag) => [tag.name, tag.id]));
}

async function fetchThread(threadId: string): Promise<ThreadLookup> {
  const bot = await getService(Services.DISCORD_MAIN_BOT);
  try {
    const channel = await bot.channels.fetch(threadId);
    return channel?.isThread()
      ? { state: "found", thread: channel }
      : { state: "gone" };
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      error.code === RESTJSONErrorCodes.UnknownChannel
    ) {
      return { state: "gone" };
    }
    logger.warn(`Could not fetch workshop thread ${threadId}: ${error}`);
    return { state: "unavailable" };
  }
}

async function removeThread(threadId: string): Promise<boolean> {
  const lookup = await fetchThread(threadId);
  if (lookup.state !== "found") return lookup.state === "gone";
  try {
    await lookup.thread.delete();
    return true;
  } catch (error) {
    logger.warn(`Could not delete thread ${threadId}, archiving: ${error}`);
    await lookup.thread.setArchived(true).catch(() => {});
    return false;
  }
}

async function clearThreadId(modId: number): Promise<void> {
  await Q.workshop.mod.updateAll({ discordThreadId: null }, { id: modId });
}

/** Create the suggestion's discussion thread and store its id on the mod row. */
export async function announceSuggestion(
  workshop: Workshop,
  mod: SuggestionAnnouncement,
): Promise<void> {
  if (
    workshop.status !== "open" ||
    !workshop.discordForumChannelId ||
    mod.discordThreadId
  ) {
    return;
  }
  try {
    const forum = await getForum(workshop.discordForumChannelId);
    if (!forum) return;

    const tags = await ensureStatusTags(forum);
    const tagName = tagNameFor(mod.status);
    const tagId = tagName ? tags.get(tagName) : undefined;

    const author = mod.project.primaryAuthor
      ? ` by ${mod.project.primaryAuthor}`
      : "";
    const note = mod.note ? `: ${mod.note}` : "";
    const lines = [
      `**${mod.project.name}**${author}`,
      `Suggested by ${Discord.Users.mention(mod.submittedBy)}${note}`,
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
    const linked = await Q.workshop.mod.updateAll(
      { discordThreadId: thread.id },
      {
        id: mod.id,
        status: { $in: LIVE_MOD_STATUSES },
        discordThreadId: null,
      },
    );
    if (linked === 0) {
      await thread.delete().catch(() => {});
      return;
    }
    const fresh = await Q.workshop.mod.find({ id: mod.id });
    if (fresh && fresh.status !== mod.status && fresh.status !== "pending") {
      await announceReview(fresh, fresh.status);
    }
  } catch (error) {
    logger.warn(
      `Failed to create suggestion thread for mod #${mod.id}: ${error}`,
    );
  }
}

/**
 * Reflect a review outcome on the suggestion's thread: post the result and
 * retag with the new status's tag or the rejection reason's tag.
 */
export async function announceReview(
  mod: WorkshopMod,
  status: Exclude<WorkshopModStatus, "pending">,
  options: { message?: string } = {},
): Promise<void> {
  if (!mod.discordThreadId) return;
  try {
    const lookup = await fetchThread(mod.discordThreadId);
    if (lookup.state === "unavailable") return;
    if (lookup.state === "gone") {
      await clearThreadId(mod.id);
      return;
    }
    const { thread } = lookup;
    if (thread.archived) await thread.setArchived(false);

    const reasonTag = mod.rejectReason
      ? REJECT_REASON_TAGS[mod.rejectReason]
      : null;
    const tagName =
      status === "rejected" ? reasonTag?.name : STATUS_TAGS[status].name;

    if (tagName && thread.parent?.type === ChannelType.GuildForum) {
      const tags = await ensureStatusTags(thread.parent);
      const tagId = tags.get(tagName);
      if (tagId) {
        const managed = new Set(
          [...tags]
            .filter(([name]) => MANAGED_TAG_NAMES.has(name))
            .map(([, id]) => id),
        );
        const kept = thread.appliedTags.filter((id) => !managed.has(id));
        await thread.setAppliedTags([tagId, ...kept].slice(0, 5));
      }
    }

    const reasonLabel = mod.rejectReason
      ? WORKSHOP_MOD_REJECT_REASON_LABELS[mod.rejectReason]
      : null;
    const content =
      status === "rejected"
        ? `${reasonTag?.emoji ?? "🚫"} **${reasonLabel ?? "Rejected"}.**${
            mod.rejectNote ? ` ${mod.rejectNote}` : ""
          }`
        : (options.message ?? REVIEW_MESSAGES[status]);
    await thread.send({ content, allowedMentions: { parse: [] } });
  } catch (error) {
    logger.warn(`Failed to post review outcome for mod #${mod.id}: ${error}`);
  }
}

/** Retag a mod that fell out of the published pack and say so on its thread. */
export async function announcePackDropOut(mod: WorkshopMod): Promise<void> {
  return announceReview(mod, "next_update", {
    message: PACK_DROP_OUT_MESSAGE,
  });
}

/** Note the auto-pulled required dependencies in the promoted mod's thread. */
export async function announcePulledDependencies(
  mod: WorkshopMod,
  names: string[],
): Promise<void> {
  if (names.length === 0) return;
  try {
    const fresh = await Q.workshop.mod.find({ id: mod.id });
    const threadId = fresh?.discordThreadId ?? mod.discordThreadId;
    if (!threadId) return;
    const lookup = await fetchThread(threadId);
    if (lookup.state !== "found") return;
    await lookup.thread.send({
      content: `📦 Pulls in required dependencies: ${names.join(", ")}`,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.warn(
      `Failed to note pulled dependencies for mod #${mod.id}: ${error}`,
    );
  }
}

/** Delete the withdrawn suggestion's thread. */
export async function announceRemoval(mod: WorkshopMod): Promise<void> {
  if (!mod.discordThreadId) return;
  try {
    await removeThread(mod.discordThreadId);
  } catch (error) {
    logger.warn(
      `Failed to remove suggestion thread for mod #${mod.id}: ${error}`,
    );
  }
}

/**
 * Reconcile a workshop's stored thread ids with Discord: forget ids whose threads
 * were deleted and recreate missing threads for live suggestions while the
 * workshop is open.
 */
export async function healThreads(
  workshop: Workshop,
  mods: WorkshopMod[],
): Promise<void> {
  const rows = mods.map((mod) => ({ ...mod }));
  for (const mod of rows) {
    if (!mod.discordThreadId) continue;
    try {
      const lookup = await fetchThread(mod.discordThreadId);
      if (lookup.state === "gone") {
        await clearThreadId(mod.id);
        mod.discordThreadId = null;
      }
    } catch (error) {
      logger.warn(`Workshop thread heal failed for mod #${mod.id}: ${error}`);
    }
  }

  if (workshop.status !== "open" || !workshop.discordForumChannelId) return;
  const missing = rows.filter(
    (mod) => !mod.discordThreadId && LIVE_MOD_STATUSES.includes(mod.status),
  );
  if (missing.length === 0) return;

  const batch = missing.slice(0, HEAL_THREAD_CREATE_CAP);
  try {
    const projects = await Q.curseforge.project.findAll({
      id: { $in: [...new Set(batch.map((mod) => mod.curseforgeProjectId))] },
    });
    const byId = new Map(projects.map((project) => [project.id, project]));
    for (const mod of batch) {
      const project = byId.get(mod.curseforgeProjectId);
      if (project) await announceSuggestion(workshop, { ...mod, project });
    }
  } catch (error) {
    logger.warn(
      `Workshop thread recreation failed for workshop #${workshop.id}: ${error}`,
    );
  }
  if (missing.length > batch.length) {
    logger.info(
      `Workshop #${workshop.id}: deferred ${missing.length - batch.length} thread recreations to the next sweep`,
    );
  }
}
