import { Q, waitlistRepo } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash commmand definition for the verify command
 * Authentication command that verifies user token from email invitation
 */
export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Verify your token from the email invitation")
  .addStringOption((option) =>
    option
      .setName("token")
      .setDescription("Your unique verification token")
      .setRequired(true),
  );

/**
 * Cooldown configuration for the verify command
 *
 * - duration: 60 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when user is on cooldown
 */
export const cooldown = {
  duration: 60,
  type: CooldownType.USER,
  message: "Please wait before trying to verify again!",
};

/**
 * Executes the verify command to verify a user invitation token
 *
 * Process:
 * 1. Read the verification token from the command options
 * 2. Fetch the invoking Discord guild member
 * 3. Validate the member object and ensure roles can be accessed
 * 4. Check that the user is currently unverified and eligible to verify
 * 5. Look up the waitlist entry associated with the provided token
 * 6. Validate that the token exists and has not been used by other user
 * 7. Update the waitlist entry with the user's Discord ID and verification state
 * 8. Update the wailist progress embed to reflect verification
 * 9. Reply with a success message to the user
 * 10. Handle and report any errors that occur during the process
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const token = interaction.options.getString("token", true);
  const discordId = interaction.user.id;
  const member = await interaction.guild!.members.fetch(interaction.user.id);

  if (
    !member ||
    typeof member.roles === "string" ||
    Array.isArray(member.roles)
  ) {
    const embed = EmbedPresets.errorWithAdmin(
      "Verification Failed",
      "Could not verify your roles. Please try again.",
    );

    await interaction.reply({
      embeds: [embed.build()],
    });
    return;
  }

  const hasUnverified = RoleManager.has(member, Discord.Roles.UNVERIFIED);

  if (!hasUnverified) {
    await interaction.reply({
      content: "❌ You are already verified or not eligible to register.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const entry = await Q.waitlist.entry.find({ token });

    if (!entry) {
      const embed = EmbedPresets.errorWithAdmin(
        "Invalid Token",
        "The token provided is invalid or has expired.",
      );

      await interaction.reply({
        embeds: [embed.build()],
      });
      return;
    }

    if (entry.discordId && entry.discordId !== discordId) {
      const embed = EmbedPresets.errorWithAdmin(
        "Invalid Already Used",
        "This token has already been used by another Discord account.",
      );

      await interaction.reply({
        embeds: [embed.build()],
      });
      return;
    }

    await Q.waitlist.entry.update(
      { id: entry.id },
      {
        discordId,
        verified: true,
        joinedDiscord: true,
        email: null,
      },
    );

    await waitlistRepo.updateProgressEmbed(entry.id);

    logger.info(
      `User ${interaction.user.tag} (${discordId}) verified within token waitlist entry ${entry.id}`,
    );

    await interaction.reply({
      content:
        "✅ Token verified! You may now use `/register <mc_name>` to link your Minecraft account and get whitelisted on the server. Replace `<mc_name>` with your Minecraft username (e.g. `/register Steve`).",
    });
  } catch (error) {
    logger.error("/verify failed:", error);
    const embed = EmbedPresets.errorWithAdmin(
      "Verification Error",
      "Something went wrong while verifying your token. Please try again.",
    );

    await interaction.reply({
      embeds: [embed.build()],
    });
  }
}
