import type { Collection, GuildTextBasedChannel, Message } from "discord.js";

const PAGE_SIZE = 100;
const EMBED_TEXT_LIMIT = 300;
const MESSAGE_LINK_PATTERN =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)$/;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export const TRANSCRIPT_MAX_MESSAGES = 500;
export const TRANSCRIPT_MAX_CHARS = 88_000;

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
): Promise<Message[]> {
  const start = await channel.messages.fetch(startId);
  const messages: Message[] = [start];
  let after = start.id;
  while (messages.length < cap) {
    const limit = Math.min(PAGE_SIZE, cap - messages.length);
    const batch = await channel.messages.fetch({ limit, after });
    messages.push(...batch.values());
    if (batch.size < limit) break;
    after = newestId(batch);
  }
  return messages.sort(byAge);
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

export function buildChannelTranscript(
  messages: Message[],
  maxChars = TRANSCRIPT_MAX_CHARS,
): ChannelTranscript {
  const relevant = messages.filter(hasContent);
  const byId = new Map(relevant.map((message) => [message.id, message]));
  const kept: { line: string; message: Message }[] = [];
  let length = 0;
  for (const message of [...relevant].reverse()) {
    const line = formatMessage(message, byId);
    if (length + line.length + 1 > maxChars) break;
    kept.push({ line, message });
    length += line.length + 1;
  }
  kept.reverse();
  return {
    text: kept.map(({ line }) => line).join("\n"),
    messageCount: kept.length,
    firstMessageUrl: kept[0]?.message.url ?? null,
  };
}
