import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { player, Q } from "@/db";
import { buildWorkshopSuggestModal } from "@/discord/bots/main/interactions/modals/workshop-suggest";
import { CooldownType } from "@/discord/utils/cooldown";
import { replyError } from "@/discord/utils/interaction-reply";
import { CurseForgeClass } from "@/services/curseforge";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import type { Workshop } from "@createrington/shared/db";

export const data = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Suggest a mod for the modpack workshop")
  .addStringOption((opt) =>
    opt
      .setName("workshop")
      .setDescription(
        "Workshop to suggest to (only needed when several are open)",
      )
      .setRequired(false)
      .setAutocomplete(true),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait a moment before suggesting again!",
};

function listOpenWorkshops(): Promise<Workshop[]> {
  return Q.workshop.findAll(
    { status: "open", classId: CurseForgeClass.mods },
    { orderBy: "createdAt", orderDirection: "desc" },
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
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

  const open = await listOpenWorkshops();
  if (open.length === 0) {
    await replyError(
      interaction,
      "No Open Workshop",
      "No workshop is currently accepting suggestions.",
    );
    return;
  }

  const optionValue = interaction.options.getString("workshop");
  let workshop = open[0];

  if (optionValue) {
    const selected = open.find((w) => String(w.id) === optionValue);
    if (!selected) {
      await replyError(
        interaction,
        "Workshop Not Open",
        "That workshop is not accepting suggestions. Pick one from the autocomplete list.",
      );
      return;
    }
    workshop = selected;
  } else if (open.length > 1) {
    const names = open.map((w) => `**${w.name}**`).join(", ");
    await replyError(
      interaction,
      "Several Workshops Open",
      `Pick one with the \`workshop\` option: ${names}`,
    );
    return;
  }

  const slotsUsed = await Q.workshop.mod.count({
    workshopId: workshop.id,
    submittedBy: interaction.user.id,
    status: "pending",
  });

  if (slotsUsed >= workshop.maxModsPerUser) {
    await replyError(
      interaction,
      "No Slots Left",
      `All ${workshop.maxModsPerUser} of your suggestion slots are in use. Slots free up when a suggestion is reviewed, or you can remove one on the website.`,
    );
    return;
  }

  await interaction.showModal(buildWorkshopSuggestModal(workshop, slotsUsed));
}

export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  if (!(await featureFlagService.isEnabled(FeatureFlags.workshop))) {
    await interaction.respond([]);
    return;
  }

  const query = interaction.options.getFocused().toLowerCase();
  const open = await listOpenWorkshops();

  await interaction.respond(
    open
      .filter((w) => w.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map((w) => ({ name: w.name, value: String(w.id) })),
  );
}
