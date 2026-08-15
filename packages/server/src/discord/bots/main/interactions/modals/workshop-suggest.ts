import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from "discord.js";
import type { Workshop } from "@createrington/shared/db";
import config from "@/config";
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
import { banNotice, findSuggestBan } from "@/services/workshop/bans";
import { discordTimestamp } from "@/utils/format";

const MODAL_ID_PREFIX = "workshop-suggest";
const PICKER_SUFFIX = "pick";
const WORKSHOP_SELECT_ID = "workshop";
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

function linkField(): LabelBuilder {
  return new LabelBuilder()
    .setLabel("CurseForge link")
    .setDescription("The mod's page on curseforge.com")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(LINK_INPUT_ID)
        .setPlaceholder("https://www.curseforge.com/minecraft/mc-mods/...")
        .setStyle(TextInputStyle.Short)
        .setMinLength(10)
        .setMaxLength(300)
        .setRequired(true),
    );
}

function noteField(): LabelBuilder {
  return new LabelBuilder()
    .setLabel("Why this mod?")
    .setDescription(
      "A short pitch, at least 10 characters. Shown with your suggestion.",
    )
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(NOTE_INPUT_ID)
        .setPlaceholder("Why this one? What does it add to the pack?")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(10)
        .setMaxLength(500)
        .setRequired(true),
    );
}

/** Builds the suggestion modal for a specific workshop. */
export function buildWorkshopSuggestModal(
  workshop: Workshop,
  slotsUsed: number,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${MODAL_ID_PREFIX}:${workshop.id}`)
    .setTitle("Suggest a mod")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Suggesting to **${workshop.name}** · ${slotsUsed} of ${workshop.maxModsPerUser} suggestion slots used`,
      ),
    )
    .addLabelComponents(linkField(), noteField());
}

/** Builds the suggestion modal with a required workshop picker on top. */
export function buildWorkshopPickerSuggestModal(
  workshops: Workshop[],
): ModalBuilder {
  const workshopField = new LabelBuilder()
    .setLabel("Workshop")
    .setStringSelectMenuComponent(
      new StringSelectMenuBuilder()
        .setCustomId(WORKSHOP_SELECT_ID)
        .setPlaceholder("Pick a workshop")
        .setRequired(true)
        .setOptions(
          workshops
            .slice(0, 25)
            .map((w) => ({ label: w.name, value: String(w.id) })),
        ),
    );

  return new ModalBuilder()
    .setCustomId(`${MODAL_ID_PREFIX}:${PICKER_SUFFIX}`)
    .setTitle("Suggest a mod")
    .addLabelComponents(workshopField, linkField(), noteField());
}

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const suffix = interaction.customId.split(":")[1];
  const workshopId =
    suffix === PICKER_SUFFIX
      ? Number(interaction.fields.getStringSelectValues(WORKSHOP_SELECT_ID)[0])
      : Number(suffix);
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
  if (workshop.status !== "open") {
    await replyError(
      interaction,
      "Suggestion Failed",
      "This workshop is not open for suggestions.",
    );
    return;
  }

  const ban = await findSuggestBan(interaction.user.id, workshop.id);
  if (ban) {
    await replyError(
      interaction,
      "Suggestions Blocked",
      banNotice(ban, (expiresAt) => discordTimestamp(expiresAt, "D")),
    );
    return;
  }

  let project: { id: number; name: string } | null;
  try {
    project = await findModBySlug(parsed.slug);
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
    const query = encodeURIComponent(parsed.slug.replace(/-/g, " "));
    const suggestUrl = `${config.meta.links.website}/workshop/${workshop.slug}/suggest?q=${query}`;
    await replyError(
      interaction,
      "Mod Not Found",
      `No mod matches \`${parsed.slug}\` on CurseForge. Double-check the link, or [search and suggest it on the website](${suggestUrl}).`,
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
