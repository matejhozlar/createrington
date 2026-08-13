import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from "discord.js";
import { player, Q } from "@/db";
import { AppError } from "@/app/middleware/error-handler";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { findModBySlug } from "@/services/curseforge";
import {
  parseModUrl,
  type ModUrlErrorReason,
} from "@/services/curseforge/mod-url";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import { workshopService } from "@/services/workshop";

const MODAL_ID_PREFIX = "workshop-suggest";
const LINK_INPUT_ID = "link";
const NOTE_INPUT_ID = "note";

const LINK_ERRORS: Record<ModUrlErrorReason, string> = {
  "not-curseforge":
    "That does not look like a CurseForge link. Paste the mod's page URL, like `https://www.curseforge.com/minecraft/mc-mods/jei`.",
  "not-a-mod":
    "That link is not a Minecraft mod page. Only mods can be suggested.",
  "missing-slug":
    "Could not find a mod in that link. Paste the mod's full page URL.",
};

export const customId = `${MODAL_ID_PREFIX}:*`;

/** Builds the suggestion modal for a specific workshop. */
export function buildWorkshopSuggestModal(workshopId: number): ModalBuilder {
  const linkInput = new TextInputBuilder()
    .setCustomId(LINK_INPUT_ID)
    .setLabel("CurseForge link")
    .setPlaceholder("https://www.curseforge.com/minecraft/mc-mods/...")
    .setStyle(TextInputStyle.Short)
    .setMinLength(10)
    .setMaxLength(300)
    .setRequired(true);

  const noteInput = new TextInputBuilder()
    .setCustomId(NOTE_INPUT_ID)
    .setLabel("Why this mod?")
    .setPlaceholder("Why this one? What does it add to the pack?")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(500)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`${MODAL_ID_PREFIX}:${workshopId}`)
    .setTitle("Suggest a mod")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(linkInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput),
    );
}

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const workshopId = Number(interaction.customId.split(":")[1]);
  if (!Number.isInteger(workshopId) || workshopId <= 0) {
    await replyError(interaction, "Suggestion Failed", "Unknown workshop.");
    return;
  }

  if (!(await featureFlagService.isEnabled(FeatureFlags.workshop))) {
    await replyError(
      interaction,
      "Workshop Disabled",
      "The workshop is currently disabled.",
    );
    return;
  }

  const suggester = await player.find({ discordId: interaction.user.id });
  if (!suggester) {
    await replyError(
      interaction,
      "Not Registered",
      "You must be registered to suggest mods. Use `/register` to get started.",
    );
    return;
  }

  const parsed = parseModUrl(
    interaction.fields.getTextInputValue(LINK_INPUT_ID),
  );
  if (!parsed.ok) {
    await replyError(interaction, "Invalid Link", LINK_ERRORS[parsed.reason]);
    return;
  }

  const note = interaction.fields.getTextInputValue(NOTE_INPUT_ID).trim();
  if (note.length < 10) {
    await replyError(
      interaction,
      "Note Too Short",
      "Add a short sentence on why this mod belongs in the pack.",
    );
    return;
  }

  const workshop = await Q.workshop.find({ id: workshopId });
  if (!workshop) {
    await replyError(
      interaction,
      "Suggestion Failed",
      "This workshop no longer exists.",
    );
    return;
  }

  let project: { id: number; name: string } | null;
  try {
    project = await findModBySlug(parsed.slug, workshop.classId);
  } catch (error) {
    logger.error("CurseForge slug lookup failed:", error);
    await replyError(
      interaction,
      "CurseForge Unavailable",
      "Could not reach CurseForge right now. Please try again in a moment.",
    );
    return;
  }

  if (!project) {
    await replyError(
      interaction,
      "Mod Not Found",
      `No mod matches \`${parsed.slug}\` on CurseForge. Double-check the link.`,
    );
    return;
  }

  try {
    await workshopService.suggestMod(workshopId, interaction.user.id, {
      projectId: project.id,
      note,
    });

    const forumLine = workshop.discordForumChannelId
      ? `\nA discussion thread will appear in <#${workshop.discordForumChannelId}> shortly.`
      : "";

    const embed = EmbedPresets.success(
      "Suggestion Added",
      `**${project.name}** is now suggested in **${workshop.name}**. It starts with your own upvote.${forumLine}`,
    );

    await interaction.editReply({ embeds: [embed.build()] });

    logger.info(
      `${interaction.user.tag} (${interaction.user.id}) suggested ${project.name} to workshop ${workshop.id} via Discord`,
    );
  } catch (error) {
    if (error instanceof AppError) {
      await replyError(interaction, "Suggestion Failed", error.message);
      return;
    }

    logger.error("/suggest modal submit failed:", error);
    await replyError(
      interaction,
      "Suggestion Failed",
      "Something went wrong while adding your suggestion. Please try again.",
    );
  }
}
