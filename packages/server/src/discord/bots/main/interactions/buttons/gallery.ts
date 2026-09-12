import { AppError } from "@/app/middleware/error-handler";
import { isAdmin } from "@/discord/utils/admin-guard";
import { container, Services } from "@/services/container";
import {
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
} from "discord.js";

export const pattern = "gallery:remove:*";

export const prodOnly = false;

export async function execute(interaction: ButtonInteraction): Promise<void> {
  const submissionId = Number.parseInt(interaction.customId.split(":")[2], 10);
  if (Number.isNaN(submissionId)) {
    await interaction.reply({
      content: "This button is no longer valid.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member as GuildMember | null;
  const admin = member ? await isAdmin(member) : false;

  try {
    const gallery = container.getSync(Services.GALLERY_SERVICE);
    await gallery.remove(submissionId, {
      discordId: interaction.user.id,
      isAdmin: admin,
    });
    await interaction.editReply("The screenshot was removed from the gallery.");
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.editReply(error.message);
      return;
    }
    logger.error(`Gallery remove button failed for #${submissionId}:`, error);
    await interaction.editReply(
      "Something went wrong while removing the screenshot. Please try again later.",
    );
  }
}
