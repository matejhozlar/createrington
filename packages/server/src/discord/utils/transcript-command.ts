import {
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type Message,
  MessageFlags,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type User,
  channelMention,
  userMention,
} from "discord.js";
import { Discord } from "@/discord/constants";
import type { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { InteractionError } from "@/discord/utils/interaction-error";
import {
  TRANSCRIPT_MAX_MESSAGES,
  buildChannelTranscript,
  fetchMessagesSince,
  fetchRecentMessages,
  parseMessageReference,
} from "@/discord/utils/channel-transcript";

const DEFAULT_MESSAGE_COUNT = 50;

const RANGE_ERRORS = {
  conflict: [
    "Pick one option",
    "Use `messages` to read the latest messages (or those up to `last_message`), or `first_message` to read from a linked message on.",
  ],
  invalidLink: [
    "Invalid message link",
    "Use a link to a message in this channel, or its ID, for `first_message` and `last_message`.",
  ],
  reversed: [
    "Messages out of order",
    "`first_message` has to be older than `last_message`.",
  ],
} as const;

interface MessageRange {
  count: number;
  firstId?: string;
  lastId?: string;
  author: User | null;
}

interface MessageSelection {
  messages: Message[];
  keep: "newest" | "oldest";
  hasMore: boolean;
}

export interface CapturedDiscussion {
  channel: GuildTextBasedChannel;
  request: {
    transcript: string;
    messageCount: number;
    requestedBy: string;
    sourceLabel: string;
    sourceUrl?: string;
    note?: string;
  };
  summary: string;
}

export function addTranscriptOptions(
  builder: SlashCommandBuilder,
  noteDescription: string,
): SlashCommandOptionsOnlyBuilder {
  return builder
    .addIntegerOption((option) =>
      option
        .setName("messages")
        .setDescription(
          `How many messages to read, ending now or at last_message (default ${DEFAULT_MESSAGE_COUNT}, max ${TRANSCRIPT_MAX_MESSAGES})`,
        )
        .setMinValue(1)
        .setMaxValue(TRANSCRIPT_MAX_MESSAGES),
    )
    .addStringOption((option) =>
      option
        .setName("first_message")
        .setDescription(
          "Link to the first message to read; reads from there up to last_message or now",
        ),
    )
    .addStringOption((option) =>
      option
        .setName("last_message")
        .setDescription(
          "Link to the last message to read; reads up to it instead of up to now",
        ),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Only read messages from this user"),
    )
    .addStringOption((option) =>
      option.setName("note").setDescription(noteDescription).setMaxLength(1000),
    );
}

function resolveChannel(
  interaction: ChatInputCommandInteraction,
): GuildTextBasedChannel | null {
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null;
  return channel;
}

function readRange(
  interaction: ChatInputCommandInteraction,
  channelId: string,
): MessageRange | keyof typeof RANGE_ERRORS {
  const first = interaction.options.getString("first_message");
  const last = interaction.options.getString("last_message");
  const count = interaction.options.getInteger("messages");
  if (first && count !== null) return "conflict";
  const firstId = first ? parseMessageReference(first, channelId) : null;
  const lastId = last ? parseMessageReference(last, channelId) : null;
  if ((first && !firstId) || (last && !lastId)) return "invalidLink";
  if (firstId && lastId && BigInt(firstId) > BigInt(lastId)) return "reversed";
  return {
    count: count ?? DEFAULT_MESSAGE_COUNT,
    ...(firstId && { firstId }),
    ...(lastId && { lastId }),
    author: interaction.options.getUser("user"),
  };
}

async function readMessages(
  channel: GuildTextBasedChannel,
  range: MessageRange,
): Promise<MessageSelection> {
  const filter = { untilId: range.lastId, authorId: range.author?.id };
  if (!range.firstId) {
    const fetched = await fetchRecentMessages(channel, range.count, filter);
    return { ...fetched, keep: "newest" };
  }
  const fetched = await fetchMessagesSince(
    channel,
    range.firstId,
    TRANSCRIPT_MAX_MESSAGES,
    filter,
  );
  return { ...fetched, keep: "oldest" };
}

function readingSummary(
  selection: MessageSelection,
  messageCount: number,
  author: User | null,
): string {
  const leftOut = selection.messages.length - messageCount;
  const from = author ? ` from ${userMention(author.id)}` : "";
  const skipped =
    leftOut > 0
      ? ` (${leftOut} ${selection.keep === "newest" ? "older" : "newer"} or empty ones left out)`
      : "";
  const capped = selection.hasMore
    ? selection.keep === "oldest"
      ? ` Only the first ${TRANSCRIPT_MAX_MESSAGES} messages after the link were read.`
      : ` Only ${TRANSCRIPT_MAX_MESSAGES} messages back were searched.`
    : "";
  return `Claude is reading ${messageCount} messages${from}${skipped}.${capped} This usually takes a minute or two.`;
}

/**
 * Reads the messages a transcript command points at (its `messages`,
 * `first_message`, `last_message`, `user` and `note` options) and defers the
 * reply as ephemeral. Resolves null after answering the interaction itself
 * when there is nothing usable to read.
 */
export async function captureDiscussion(
  interaction: ChatInputCommandInteraction,
): Promise<CapturedDiscussion | null> {
  const channel = resolveChannel(interaction);
  if (!channel) {
    await replyError(
      interaction,
      "Invalid channel",
      "This command can only be used in server text channels.",
    );
    return null;
  }

  const range = readRange(interaction, channel.id);
  if (typeof range === "string") {
    const [title, description] = RANGE_ERRORS[range];
    await replyError(interaction, title, description);
    return null;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const selection = await readMessages(channel, range).catch(
    (error: unknown) => {
      throw new InteractionError(
        "Could not read messages",
        "Check that the links point to messages in this channel and that the bot can read its history.",
        { cause: error },
      );
    },
  );

  const transcript = buildChannelTranscript(selection.messages, {
    keep: selection.keep,
  });
  if (transcript.messageCount === 0) {
    await replyError(
      interaction,
      "Nothing to read",
      range.author
        ? `${userMention(range.author.id)} has no messages with content in that range.`
        : "There are no messages with content to send.",
    );
    return null;
  }

  const note = interaction.options.getString("note");
  return {
    channel,
    request: {
      transcript: transcript.text,
      messageCount: transcript.messageCount,
      requestedBy: interaction.user.username,
      sourceLabel: `#${channel.name}`,
      ...(transcript.firstMessageUrl && {
        sourceUrl: transcript.firstMessageUrl,
      }),
      ...(note && { note }),
    },
    summary: readingSummary(selection, transcript.messageCount, range.author),
  };
}

/**
 * Shows the outcome of a transcript command to the admin who ran it and
 * posts it to the admin notifications channel. Either can fail without
 * stopping the other.
 */
export async function announceOutcome(
  interaction: ChatInputCommandInteraction,
  command: string,
  sessionId: number,
  channelId: string,
  embed: ReturnType<typeof EmbedPresets.info>,
): Promise<void> {
  const [edited, posted] = await Promise.allSettled([
    interaction.editReply({ embeds: [embed.build()] }),
    Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      content: `${userMention(interaction.user.id)} \`/${command}\` in ${channelMention(channelId)}`,
      embeds: embed.build(),
      allowedMentions: { users: [interaction.user.id] },
    }),
  ]);
  if (edited.status === "rejected") {
    logger.warn(
      `/${command} session #${sessionId} could not update its reply:`,
      edited.reason,
    );
  }
  if (posted.status === "rejected") {
    logger.warn(
      `/${command} session #${sessionId} could not post to admin notifications:`,
      posted.reason,
    );
  }
}
