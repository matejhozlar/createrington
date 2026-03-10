import { Q, waitlistRepo } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the register command
 * Registers the user into the system
 */
export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Register to Createrington")
  .addStringOption((option) =>
    option
      .setName("mc_name")
      .setDescription("Your exact Minecraft username (case doesn't matter)")
      .setRequired(true),
  );

/**
 * Cooldown configuration for the ping command
 *
 * - duration: 60 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when user is on cooldown
 */
export const cooldown = {
  duration: 60,
  type: CooldownType.USER,
  message: "Please wait before trying to register again!",
};

/**
 * Whether this command should only be available in production
 * Set to false to allow usage in development
 */

/**
 * Random delay helper for realistic progress updates
 * Mainly used to minimize API blocking
 */
function randomDelay(min = 1000, max = 3000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registration steps
 */
interface RegistrationStep {
  name: string;
  completed: boolean;
  error?: string;
}

const STEPS: RegistrationStep[] = [
  { name: "Validate Discord account", completed: false },
  { name: "Check Minecraft username", completed: false },
  { name: "Verify account availability", completed: false },
  { name: "Add to server whitelist", completed: false },
  { name: "Save to database", completed: false },
  { name: "Assign Discord roles", completed: false },
];

/**
 * Executes the register command to register the user
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const mcName = interaction.options.getString("mc_name", true);
  const discordId = interaction.user.id;
  const member = await interaction.guild!.members.fetch(interaction.user.id);

  const steps = STEPS.map((s) => ({ ...s }));
  let currentStep = 0;

  if (
    !member ||
    typeof member.roles === "string" ||
    Array.isArray(member.roles)
  ) {
    const embed = EmbedPresets.errorWithAdmin(
      "Registration Failed",
      "Could not verify your roles. Please try again.",
    );

    await interaction.reply({
      embeds: [embed.build()],
    });
    return;
  }

  const hasUnverified = RoleManager.has(member, Discord.Roles.UNVERIFIED);

  if (!hasUnverified) {
    const embed = EmbedPresets.error(
      "Already Registered",
      "You are already verified or not eligible to register",
    );

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const progressEmbed = EmbedPresets.registration.userProgress(
    mcName,
    steps,
    currentStep,
  );

  await interaction.reply({
    embeds: [progressEmbed.build()],
  });

  try {
    await randomDelay();
    const entry = await Q.waitlist.entry.find({ discordId });

    if (!entry || !entry.verified) {
      steps[currentStep].error = "No verified waitlist entry found";
      throw new Error(
        "You haven't verified your token yet. Run `/verify <token>` first.",
      );
    }

    steps[currentStep].completed = true;
    currentStep++;

    await interaction.editReply({
      embeds: [
        EmbedPresets.registration
          .userProgress(mcName, steps, currentStep)
          .build(),
      ],
    });

    await randomDelay();

    const response = await fetch(
      `https://playerdb.co/api/player/minecraft/${mcName}`,
    );
    const result = (await response.json()) as {
      success: boolean;
      data: { player?: { id: string; username: string } };
    };

    if (!response.ok || !result.success || !result.data.player?.id) {
      steps[currentStep].error = "Minecraft account not found";
      throw new Error(`No Minecraft account found with the name \`${mcName}\``);
    }

    const uuid = result.data.player.id;
    const correctName = result.data.player.username;

    steps[currentStep].completed = true;
    currentStep++;

    await interaction.editReply({
      embeds: [
        EmbedPresets.registration
          .userProgress(correctName, steps, currentStep)
          .build(),
      ],
    });

    await randomDelay();
    const exists = await Q.player.exists({ minecraftUuid: uuid });

    if (exists) {
      steps[currentStep].error = "Account already registered";
      throw new Error(
        `This Minecraft account (\`${correctName}\`) is already registered`,
      );
    }

    steps[currentStep].completed = true;
    currentStep++;

    await interaction.editReply({
      embeds: [
        EmbedPresets.registration
          .userProgress(correctName, steps, currentStep)
          .build(),
      ],
    });

    await randomDelay();

    try {
      await minecraftRcon.whitelistAll(WhitelistAction.ADD, correctName);
    } catch (error) {
      steps[currentStep].error = "Failed to add to whitelist";
      throw new Error(`Failed to whitelist ${correctName}: ${error}`);
    }

    steps[currentStep].completed = true;
    currentStep++;

    await interaction.editReply({
      embeds: [
        EmbedPresets.registration
          .userProgress(correctName, steps, currentStep)
          .build(),
      ],
    });

    await randomDelay();
    await Q.player.create({
      minecraftUuid: uuid,
      minecraftUsername: correctName,
      discordId,
    });
    await Q.player.balance.create({
      minecraftUuid: uuid,
    });

    await Q.waitlist.entry.update({ id: entry.id }, { registered: true });
    await waitlistRepo.updateProgressEmbed(entry.id);

    steps[currentStep].completed = true;
    currentStep++;

    await interaction.editReply({
      embeds: [
        EmbedPresets.registration
          .userProgress(correctName, steps, currentStep)
          .build(),
      ],
    });

    await randomDelay();
    await RoleManager.remove(member, Discord.Roles.UNVERIFIED);
    await RoleManager.assign(member, Discord.Roles.VERIFIED);

    steps[currentStep].completed = true;

    await interaction.editReply({
      embeds: [
        EmbedPresets.registration
          .userProgress(correctName, steps, currentStep)
          .build(),
      ],
    });

    await randomDelay(500, 1000);

    const { embed, closeButton } = EmbedPresets.registration.userSuccess(
      correctName,
      uuid,
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      closeButton,
    );

    await interaction.editReply({
      embeds: [embed.build()],
      components: [row],
    });

    logger.info(
      `User ${interaction.user.tag} (${discordId}) registered as ${correctName} (${uuid})`,
    );
  } catch (error) {
    logger.error("/register failed:", error);

    const adminEmbed = EmbedPresets.registration.adminError(
      mcName,
      interaction.user.tag,
      discordId,
      error instanceof Error ? error.message : String(error),
      steps[currentStep]?.name || "Unknown step",
    );

    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: adminEmbed.build(),
      content: Discord.Roles.mention(Discord.Roles.ADMIN),
    });

    const userErrorEmbed = EmbedPresets.registration.userError(
      mcName,
      error instanceof Error ? error.message : String(error),
      steps[currentStep]?.name || "Unknown step",
    );

    await interaction.editReply({
      embeds: [userErrorEmbed.build()],
      components: [],
    });
  }
}
