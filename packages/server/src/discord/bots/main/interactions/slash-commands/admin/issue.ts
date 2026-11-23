import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { InteractionError } from "@/discord/utils/interaction-error";
import {
  addTranscriptOptions,
  announceOutcome,
  captureDiscussion,
} from "@/discord/utils/transcript-command";
import { AutomationStartError } from "@/services/claude-automation/session-client";
import {
  issueTriageService,
  type IssueTriageStatus,
} from "@/services/issue-triage/issue-triage.service";
import type {
  CommandModule,
  CommandPermissions,
} from "@/discord/bots/common/loaders/command-loader";

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
  orphaned: "Claude automation lost track of this session.",
  closed: "The session was stopped before it finished.",
};

const data = addTranscriptOptions(
  new SlashCommandBuilder()
    .setName("issue")
    .setDescription(
      "Have Claude file a Gitea issue from the recent messages here",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  "What to report, if the messages cover more than one thing",
);

const permissions: CommandPermissions = {
  requireAdmin: true,
};

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
  channelId: string,
): Promise<void> {
  const outcome = await issueTriageService.waitForOutcome(sessionId);
  await announceOutcome(
    interaction,
    "issue",
    sessionId,
    channelId,
    outcomeEmbed(outcome),
  );
  logger.info(
    `/issue session #${sessionId} by ${interaction.user.tag}: ${outcome?.result ?? "pending"}${
      outcome?.issue ? ` (${outcome.issue.repo}#${outcome.issue.number})` : ""
    }`,
  );
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discussion = await captureDiscussion(interaction);
  if (!discussion) return;

  let sessionId: number;
  try {
    ({ sessionId } = await issueTriageService.start(discussion.request));
  } catch (error) {
    const kind = error instanceof AutomationStartError ? error.kind : "failed";
    const [title, description] = START_ERRORS[kind];
    if (kind === "failed") {
      throw new InteractionError(title, description, { cause: error });
    }
    await replyError(interaction, title, description);
    return;
  }

  await interaction.editReply({
    embeds: [EmbedPresets.info("Triaging", discussion.summary).build()],
  });

  void reportOutcome(interaction, sessionId, discussion.channel.id).catch(
    (error) =>
      logger.error(
        `/issue session #${sessionId} could not report back:`,
        error,
      ),
  );
}

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
