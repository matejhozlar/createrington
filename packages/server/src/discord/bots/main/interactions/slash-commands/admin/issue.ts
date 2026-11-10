import {
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  TRANSCRIPT_MAX_MESSAGES,
  buildChannelTranscript,
  fetchMessagesSince,
  fetchRecentMessages,
  parseMessageReference,
} from "@/discord/utils/channel-transcript";
import {
  IssueTriageError,
  issueTriageService,
  type IssueTriageStatus,
} from "@/services/issue-triage";

const DEFAULT_MESSAGE_COUNT = 50;

const START_ERRORS = {
  not_configured: [
    "Issue triage is not set up",
    "This environment has no connection to Claude automation.",
  ],
  busy: [
    "Claude is busy",
    "Too many issues are being triaged right now. Try again in a few minutes.",
  ],
  failed: [
    "Could not start triage",
    "Claude automation did not accept the request. Try again later.",
  ],
} as const;

const FAILURE_REASONS: Record<string, string> = {
  timeout: "Claude ran out of time before finishing.",
  invalid_result: "Claude did not produce a usable issue.",
  auth_error: "Claude automation could not authenticate.",
  orphaned: "Claude automation restarted while this was running.",
};

export const data = new SlashCommandBuilder()
  .setName("issue")
  .setDescription(
    "Have Claude file a Gitea issue from the recent messages here",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((option) =>
    option
      .setName("messages")
      .setDescription(
        `How many recent messages to read (default ${DEFAULT_MESSAGE_COUNT}, max ${TRANSCRIPT_MAX_MESSAGES})`,
      )
      .setMinValue(1)
      .setMaxValue(TRANSCRIPT_MAX_MESSAGES),
  )
  .addStringOption((option) =>
    option
      .setName("from")
      .setDescription(
        "Link to the first message to read; reads from there to now instead",
      ),
  )
  .addStringOption((option) =>
    option
      .setName("note")
      .setDescription(
        "What to report, if the messages cover more than one thing",
      )
      .setMaxLength(1000),
  );

export const permissions = {
  requireAdmin: true,
};

function resolveChannel(
  interaction: ChatInputCommandInteraction,
): GuildTextBasedChannel | null {
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null;
  return channel;
}

interface MessageSelection {
  messages: Message[];
  keep: "newest" | "oldest";
  hasMore: boolean;
}

async function readMessages(
  interaction: ChatInputCommandInteraction,
  channel: GuildTextBasedChannel,
): Promise<MessageSelection | null> {
  const from = interaction.options.getString("from");
  if (!from) {
    const count =
      interaction.options.getInteger("messages") ?? DEFAULT_MESSAGE_COUNT;
    const messages = await fetchRecentMessages(channel, count);
    return { messages, keep: "newest", hasMore: false };
  }
  const startId = parseMessageReference(from, channel.id);
  if (!startId) return null;
  const { messages, hasMore } = await fetchMessagesSince(
    channel,
    startId,
    TRANSCRIPT_MAX_MESSAGES,
  );
  return { messages, keep: "oldest", hasMore };
}

function readingSummary(
  selection: MessageSelection,
  messageCount: number,
): string {
  const leftOut = selection.messages.length - messageCount;
  const skipped =
    leftOut > 0
      ? ` (${leftOut} ${selection.keep === "newest" ? "older" : "newer"} or empty ones left out)`
      : "";
  const capped = selection.hasMore
    ? ` Only the first ${TRANSCRIPT_MAX_MESSAGES} messages after the link were read.`
    : "";
  return `Claude is reading ${messageCount} messages${skipped}.${capped} This usually takes a minute or two.`;
}

function outcomeEmbed(outcome: IssueTriageStatus | null) {
  if (!outcome) {
    return EmbedPresets.info(
      "Still working",
      "Claude has not finished yet. Check Gitea in a few minutes.",
    );
  }
  const { issue, reason, result } = outcome;
  if (result === "filed" && issue) {
    return EmbedPresets.success(
      "Issue filed",
      `[${issue.repo}#${issue.number}](${issue.url}): ${issue.title}`,
    );
  }
  if (result === "duplicate" && issue) {
    return EmbedPresets.info(
      "Already reported",
      [`[${issue.repo}#${issue.number}](${issue.url}): ${issue.title}`, reason]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  if (result === "no_issue") {
    return EmbedPresets.info(
      "Nothing to report",
      reason ?? "Claude found no problem to file in those messages.",
    );
  }
  return EmbedPresets.error(
    "Triage failed",
    reason ??
      FAILURE_REASONS[result ?? ""] ??
      "Claude could not file this issue.",
  );
}

async function reportOutcome(
  interaction: ChatInputCommandInteraction,
  sessionId: number,
): Promise<void> {
  const outcome = await issueTriageService.waitForOutcome(sessionId);
  await interaction.editReply({ embeds: [outcomeEmbed(outcome).build()] });
  logger.info(
    `/issue session #${sessionId} by ${interaction.user.tag}: ${outcome?.result ?? "pending"}${
      outcome?.issue ? ` (${outcome.issue.repo}#${outcome.issue.number})` : ""
    }`,
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channel = resolveChannel(interaction);
  if (!channel) {
    await replyError(
      interaction,
      "Invalid channel",
      "This command can only be used in server text channels.",
    );
    return;
  }

  if (
    interaction.options.getString("from") &&
    interaction.options.getInteger("messages") !== null
  ) {
    await replyError(
      interaction,
      "Pick one option",
      "Use `messages` to read the latest messages, or `from` to read from a linked message up to now.",
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let selection: MessageSelection | null;
  try {
    selection = await readMessages(interaction, channel);
  } catch (error) {
    logger.error("/issue could not read messages:", error);
    await replyError(
      interaction,
      "Could not read messages",
      "Check that the link points to a message in this channel and that the bot can read its history.",
    );
    return;
  }
  if (!selection) {
    await replyError(
      interaction,
      "Invalid message link",
      "Use a link to a message in this channel, or its ID.",
    );
    return;
  }

  const transcript = buildChannelTranscript(selection.messages, {
    keep: selection.keep,
  });
  if (transcript.messageCount === 0) {
    await replyError(
      interaction,
      "Nothing to read",
      "There are no messages with content to send.",
    );
    return;
  }

  const note = interaction.options.getString("note");
  let sessionId: number;
  try {
    ({ sessionId } = await issueTriageService.start({
      transcript: transcript.text,
      messageCount: transcript.messageCount,
      requestedBy: interaction.user.username,
      sourceLabel: `#${channel.name}`,
      ...(transcript.firstMessageUrl && {
        sourceUrl: transcript.firstMessageUrl,
      }),
      ...(note && { note }),
    }));
  } catch (error) {
    const kind = error instanceof IssueTriageError ? error.kind : "failed";
    if (kind === "failed") {
      logger.error("/issue could not start triage:", error);
    }
    const [title, description] = START_ERRORS[kind];
    await replyError(interaction, title, description);
    return;
  }

  await interaction.editReply({
    embeds: [
      EmbedPresets.info(
        "Triaging",
        readingSummary(selection, transcript.messageCount),
      ).build(),
    ],
  });

  void reportOutcome(interaction, sessionId).catch((error) =>
    logger.error(`/issue session #${sessionId} could not report back:`, error),
  );
}
