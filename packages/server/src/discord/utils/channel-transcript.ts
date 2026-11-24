import { isDiscordId } from "@createrington/shared/discord-id";
import type { Collection, GuildTextBasedChannel, Message } from "discord.js";

const PAGE_SIZE = 100;
const EMBED_TEXT_LIMIT = 300;
const MESSAGE_LINK_PATTERN =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)$/;

const TRANSCRIPT_MAX_BYTES = 88_000;

export const TRANSCRIPT_MAX_MESSAGES = 500;

export interface ChannelTranscript {
  text: string;
  messageCount: number;
  firstMessageUrl: string | null;
}

function byAge(a: Message, b: Message): number {
  return a.createdTimestamp - b.createdTimestamp;
}

function oldestId(batch: Collection<string, Message>): string {
  return [...batch.values()].sort(byAge)[0].id;
}

function newestId(batch: Collection<string, Message>): string {
  return [...batch.values()].sort(byAge).at(-1)!.id;
}

export function parseMessageReference(
  input: string,
  channelId: string,
): string | null {
  const value = input.trim();
  if (isDiscordId(value)) return value;
  const match = MESSAGE_LINK_PATTERN.exec(value);
  if (!match || match[2] !== channelId) return null;
  return match[3];
}

export interface MessageFilter {
  untilId?: string;
  authorId?: string;
}

export interface FetchedMessages {
  messages: Message[];
  hasMore: boolean;
}

function byAuthor(authorId: string | undefined): (message: Message) => boolean {
  return (message) => !authorId || message.author.id === authorId;
}

function isAtOrBefore(id: string, untilId: string | undefined): boolean {
  return !untilId || BigInt(id) <= BigInt(untilId);
}

export async function fetchRecentMessages(
  channel: GuildTextBasedChannel,
  count: number,
  { untilId, authorId }: MessageFilter = {},
): Promise<FetchedMessages> {
  const wanted = byAuthor(authorId);
  const messages: Message[] = [];
  let scanned = 0;
  let before = untilId;
  if (untilId) {
    const last = await channel.messages.fetch(untilId);
    scanned = 1;
    if (wanted(last)) messages.push(last);
  }
  while (messages.length < count) {
    const budget = TRANSCRIPT_MAX_MESSAGES - scanned;
    if (budget <= 0) {
      const older = await channel.messages.fetch({
        limit: 1,
        ...(before && { before }),
      });
      return { messages: messages.sort(byAge), hasMore: older.size > 0 };
    }
    const remaining = count - messages.length;
    const limit = Math.min(PAGE_SIZE, authorId ? budget : remaining);
    const batch = await channel.messages.fetch({
      limit,
      ...(before && { before }),
    });
    scanned += batch.size;
    const newestFirst = [...batch.values()].sort(byAge).reverse();
    messages.push(...newestFirst.filter(wanted).slice(0, remaining));
    if (batch.size < limit) break;
    before = oldestId(batch);
  }
  return { messages: messages.sort(byAge), hasMore: false };
}

export async function fetchMessagesSince(
  channel: GuildTextBasedChannel,
  startId: string,
  cap: number,
  { untilId, authorId }: MessageFilter = {},
): Promise<FetchedMessages> {
  const [start] = await Promise.all([
    channel.messages.fetch(startId),
    untilId && channel.messages.fetch(untilId),
  ]);
  const scanned: Message[] = [start];
  const target = cap + 1;
  let after = start.id;
  while (scanned.length < target) {
    const limit = Math.min(PAGE_SIZE, target - scanned.length);
    const batch = await channel.messages.fetch({ limit, after });
    const inRange = [...batch.values()].filter((message) =>
      isAtOrBefore(message.id, untilId),
    );
    scanned.push(...inRange);
    if (batch.size < limit || inRange.length < batch.size) break;
    after = newestId(batch);
  }
  scanned.sort(byAge);
  return {
    messages: scanned.slice(0, cap).filter(byAuthor(authorId)),
    hasMore: scanned.length > cap,
  };
}

function authorName(message: Message): string {
  const display =
    message.member?.displayName ??
    message.author.globalName ??
    message.author.username;
  const handle =
    display === message.author.username ? "" : ` (@${message.author.username})`;
  return `${display}${handle}${message.author.bot ? " [bot]" : ""}`;
}

function embedText(message: Message): string[] {
  return message.embeds
    .map((embed) =>
      [embed.title, embed.description]
        .filter(Boolean)
        .join(": ")
        .slice(0, EMBED_TEXT_LIMIT),
    )
    .filter((text) => text.length > 0)
    .map((text) => `[embed: ${text}]`);
}

function formatMessage(message: Message, byId: Map<string, Message>): string {
  const time = message.createdAt.toISOString().slice(0, 16).replace("T", " ");
  const replyTo = message.reference?.messageId
    ? byId.get(message.reference.messageId)
    : undefined;
  const reply = message.reference?.messageId
    ? ` (replying to ${replyTo ? authorName(replyTo) : "an earlier message"})`
    : "";
  const parts = [
    message.cleanContent.replace(/\n/g, "\n    "),
    ...message.attachments.map(
      (attachment) => `[attachment: ${attachment.name} ${attachment.url}]`,
    ),
    ...embedText(message),
  ].filter((part) => part.length > 0);
  return `[${time} UTC] ${authorName(message)}${reply}: ${parts.join(" ")}`;
}

function hasContent(message: Message): boolean {
  return (
    message.cleanContent.trim().length > 0 ||
    message.attachments.size > 0 ||
    message.embeds.length > 0
  );
}

function encodedSize(line: string): number {
  return Buffer.byteLength(JSON.stringify(line), "utf8");
}

export function buildChannelTranscript(
  messages: Message[],
  options: { keep?: "newest" | "oldest"; maxBytes?: number } = {},
): ChannelTranscript {
  const keep = options.keep ?? "newest";
  const maxBytes = options.maxBytes ?? TRANSCRIPT_MAX_BYTES;
  const relevant = messages.filter(hasContent);
  const byId = new Map(relevant.map((message) => [message.id, message]));
  const ordered = keep === "newest" ? [...relevant].reverse() : relevant;
  const kept: { line: string; message: Message }[] = [];
  let size = 0;
  for (const message of ordered) {
    const line = formatMessage(message, byId);
    const lineSize = encodedSize(line);
    if (size + lineSize > maxBytes) break;
    kept.push({ line, message });
    size += lineSize;
  }
  if (keep === "newest") kept.reverse();
  return {
    text: kept.map(({ line }) => line).join("\n"),
    messageCount: kept.length,
    firstMessageUrl: kept[0]?.message.url ?? null,
  };
}
