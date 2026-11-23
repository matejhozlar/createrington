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
  type CapturedDiscussion,
} from "@/discord/utils/transcript-command";
import { AutomationStartError } from "@/services/claude-automation/session-client";
import { planningIntakeService } from "@/services/planning-intake/planning-intake.service";
import type {
  CommandModule,
  CommandPermissions,
} from "@/discord/bots/common/loaders/command-loader";

const START_ERRORS = {
  not_configured: [
    "Planning intake is not set up",
    "This environment has no connection to Claude automation.",
  ],
  busy: [
    "Claude is busy",
    "Too many discussions are being read right now. Try again in a few minutes.",
  ],
  failed: [
    "Could not start",
    "Claude automation did not accept the request. Try again later.",
  ],
} as const;

const FAILURE_REASONS: Record<string, string> = {
  timeout: "Claude ran out of time before finishing.",
  invalid_result: "Claude did not produce a usable plan.",
  auth_error: "Claude automation could not authenticate.",
  orphaned: "Claude automation lost track of this session.",
  closed: "The session was stopped before it finished.",
};

const SAVED_TITLES = {
  created: "Draft added to planning",
  commented: "Comment added to a plan",
} as const;

const data = addTranscriptOptions(
  new SlashCommandBuilder()
    .setName("idea")
    .setDescription(
      "Have Claude write up the recent discussion here as a planning draft",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  "What to capture, if the messages cover more than one thing",
);

const permissions: CommandPermissions = {
  requireAdmin: true,
};

async function settle(
  interaction: ChatInputCommandInteraction,
  sessionId: number,
  discussion: CapturedDiscussion,
) {
  const outcome = await planningIntakeService.waitForOutcome(sessionId);
  if (!outcome) {
    return EmbedPresets.error(
      "Timed out",
      "Claude did not finish in time, so nothing was added. Try again.",
    );
  }

  const { proposal, reason, result } = outcome;
  if (result === "proposed" && proposal) {
    try {
      const saved = await planningIntakeService.apply(proposal, {
        discordId: interaction.user.id,
        sourceUrl: discussion.request.sourceUrl ?? null,
      });
      return EmbedPresets.success(
        SAVED_TITLES[saved.kind],
        `[${saved.title}](${saved.url})`,
      );
    } catch (error) {
      logger.error(
        `/idea session #${sessionId} could not save its proposal:`,
        error,
      );
      return EmbedPresets.error(
        "Could not save",
        "Claude wrote a proposal, but it could not be saved. Try again.",
      );
    }
  }
  if (result === "no_card") {
    return EmbedPresets.info(
      "Nothing to add",
      reason ?? "Claude found nothing in those messages worth planning.",
    );
  }
  return EmbedPresets.error(
    "Planning intake failed",
    reason ??
      FAILURE_REASONS[result ?? ""] ??
      "Claude could not read this discussion.",
  );
}

async function reportOutcome(
  interaction: ChatInputCommandInteraction,
  sessionId: number,
  discussion: CapturedDiscussion,
): Promise<void> {
  const embed = await settle(interaction, sessionId, discussion);
  await announceOutcome(
    interaction,
    "idea",
    sessionId,
    discussion.channel.id,
    embed,
  );
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const discussion = await captureDiscussion(interaction);
  if (!discussion) return;

  let sessionId: number;
  try {
    ({ sessionId } = await planningIntakeService.start(discussion.request));
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
    embeds: [EmbedPresets.info("Reading", discussion.summary).build()],
  });
  logger.info(
    `/idea session #${sessionId} started by ${interaction.user.tag} in #${discussion.channel.name}`,
  );

  void reportOutcome(interaction, sessionId, discussion).catch((error) =>
    logger.error(`/idea session #${sessionId} could not report back:`, error),
  );
}

export default {
  data,
  permissions,
  execute,
} satisfies CommandModule;
