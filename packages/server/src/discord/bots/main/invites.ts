import config from "@/config";
import type { Client, Guild, Invite } from "discord.js";
import { mainBot } from "@/discord/bots/main/client";

/** In-memory snapshot of each guild's invite usage counts, keyed by guild id then invite code */
const inviteUseCache = new Map<string, Map<string, number>>();

/** Per-guild serialization of diff-and-update so two near-simultaneous joins
 * don't read the same baseline and miss the second consumer. */
const diffQueue = new Map<string, Promise<string | null>>();

/** TTLs for waitlist invites. Admin-issued invites go by email and may sit in an
 * inbox for a few days before being opened, so they get a long window. */
export const INVITE_MAX_AGE_SECONDS = {
  MANUAL_INVITE: 7 * 24 * 60 * 60, // 7 days
} as const;

function getWelcomeChannelId(): string {
  const channelId = config.discord.events.onGuildMemberAdd.welcome.channelId;
  if (!channelId) {
    throw new Error(
      "Welcome channel is not configured; cannot create waitlist invite",
    );
  }
  return channelId;
}

function getGuild(client: Client): Guild {
  const guildId = config.discord.guild.id;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error(`Guild ${guildId} not found in client cache`);
  }
  return guild;
}

async function snapshotInvites(guild: Guild): Promise<Map<string, number>> {
  const invites = await guild.invites.fetch();
  const snapshot = new Map<string, number>();
  for (const [code, invite] of invites) {
    snapshot.set(code, invite.uses ?? 0);
  }
  return snapshot;
}

/** Seeds the invite-use cache for all guilds the bot is in. Call on client ready. */
export async function buildInviteCache(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      const snapshot = await snapshotInvites(guild);
      inviteUseCache.set(guild.id, snapshot);
      logger.info(
        `Seeded invite cache for guild ${guild.name}: ${snapshot.size} invites`,
      );
    } catch (error) {
      logger.warn(`Failed to seed invite cache for guild ${guild.id}:`, error);
    }
  }
}

/**
 * Diffs the cached invite-use counts against the guild's current invites to find
 * which invite was consumed by the most recent join. Updates the cache afterwards.
 *
 * @returns The consumed invite code, or null if it couldn't be determined
 */
export async function diffAndUpdateInvites(
  guild: Guild,
): Promise<string | null> {
  // Serialize per-guild so concurrent joins don't race on the shared cache.
  // Each call chains onto the previous one's completion, then does its own
  // snapshot + diff + cache write atomically.
  const previousTask = diffQueue.get(guild.id) ?? Promise.resolve(null);
  const task = previousTask.catch(() => null).then(() => performDiff(guild));
  diffQueue.set(guild.id, task);

  try {
    return await task;
  } finally {
    // Only clear if we're still the latest task (otherwise a newer call owns the slot).
    if (diffQueue.get(guild.id) === task) {
      diffQueue.delete(guild.id);
    }
  }
}

async function performDiff(guild: Guild): Promise<string | null> {
  const previous = inviteUseCache.get(guild.id) ?? new Map<string, number>();
  let current: Map<string, number>;
  try {
    current = await snapshotInvites(guild);
  } catch (error) {
    logger.warn(`Failed to fetch invites for guild ${guild.id}:`, error);
    return null;
  }

  let consumed: string | null = null;
  for (const [code, uses] of current) {
    const prev = previous.get(code) ?? 0;
    if (uses > prev) {
      consumed = code;
      break;
    }
  }

  // Also check for invites that vanished (e.g. a one-use invite that was consumed
  // and auto-deleted by Discord before we snapshot again).
  if (!consumed) {
    for (const code of previous.keys()) {
      if (!current.has(code)) {
        consumed = code;
        break;
      }
    }
  }

  inviteUseCache.set(guild.id, current);
  return consumed;
}

/**
 * Creates a single-use Discord invite for a waitlist applicant.
 *
 * @param maxAgeSeconds - How long the invite is valid before Discord expires it
 * @param reason - Audit-log reason shown in the Discord server settings
 * @returns The new invite's code and URL
 */
export async function createOneUseInvite(
  maxAgeSeconds: number,
  reason: string,
): Promise<{
  code: string;
  url: string;
}> {
  const guild = getGuild(mainBot);
  const channelId = getWelcomeChannelId();

  const invite: Invite = await guild.invites.create(channelId, {
    maxUses: 1,
    maxAge: maxAgeSeconds,
    unique: true,
    reason,
  });

  // Seed the cache so the freshly created invite is tracked at 0 uses before
  // the member joins, otherwise the diff won't find it.
  const cached = inviteUseCache.get(guild.id) ?? new Map<string, number>();
  cached.set(invite.code, invite.uses ?? 0);
  inviteUseCache.set(guild.id, cached);

  return { code: invite.code, url: invite.url };
}
