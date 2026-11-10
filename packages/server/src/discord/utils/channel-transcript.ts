import type { Collection, GuildTextBasedChannel, Message } from "discord.js";

const PAGE_SIZE = 100;
const EMBED_TEXT_LIMIT = 300;
const MESSAGE_LINK_PATTERN =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)$/;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

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
  if (SNOWFLAKE_PATTERN.test(value)) return value;
  const match = MESSAGE_LINK_PATTERN.exec(value);
  if (!match || match[2] !== channelId) return null;
  return match[3];
}

export async function fetchRecentMessages(
  channel: GuildTextBasedChannel,
  count: number,
): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;
  while (messages.length < count) {
    const limit = Math.min(PAGE_SIZE, count - messages.length);
    const batch = await channel.messages.fetch({
      limit,
      ...(before && { before }),
    });
    messages.push(...batch.values());
    if (batch.size < limit) break;
    before = oldestId(batch);
  }
  return messages.sort(byAge);
}

export async function fetchMessagesSince(
  channel: GuildTextBasedChannel,
  startId: string,
  cap: number,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const start = await channel.messages.fetch(startId);
  const messages: Message[] = [start];
  const target = cap + 1;
  let after = start.id;
  while (messages.length < target) {
    const limit = Math.min(PAGE_SIZE, target - messages.length);
    const batch = await channel.messages.fetch({ limit, after });
    messages.push(...batch.values());
    if (batch.size < limit) break;
    after = newestId(batch);
  }
  messages.sort(byAge);
  return { messages: messages.slice(0, cap), hasMore: messages.length > cap };
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
