import { Q, waitlistRepo } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import {
  AUTO_CLOSE_MS,
  scheduleChannelClose,
} from "@/discord/bots/main/registration-cleanup";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import { ActionRowBuilder } from "discord.js";
import type {
  ButtonBuilder,
  GuildMember,
  GuildTextBasedChannel,
} from "discord.js";
import type { DiscordEmbedBuilder } from "@/discord/embeds/embed-builder";
import { buildIdleWelcomeMessage } from "./welcome-message";

/** Minimal shape each entry point (slash command, modal submit) supplies so the
 * core flow can render the embed without caring where it lands. */
export type RegistrationRenderer = (payload: {
  embeds: DiscordEmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder>[];
}) => Promise<void>;

function randomDelay(min = 1000, max = 3000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export interface RegistrationResult {
  ok: boolean;
  errorMessage?: string;
}

/** Runs the full registration flow, calling `render` at each step to update
 * whichever anchor message the caller manages (slash-command reply or the
 * welcome channel message). */
export async function runRegistration(params: {
  member: GuildMember;
  discordId: string;
  userTag: string;
  username: string;
  mcName: string;
  channel: GuildTextBasedChannel | null;
  render: RegistrationRenderer;
}): Promise<RegistrationResult> {
  const { member, discordId, userTag, username, mcName, channel, render } =
    params;

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
    await render({ embeds: [embed] });
    return { ok: false, errorMessage: "roles unavailable" };
  }

  if (!RoleManager.has(member, Discord.Roles.UNVERIFIED)) {
    const embed = EmbedPresets.error(
      "Already Registered",
      "You are already verified or not eligible to register",
    );
    await render({ embeds: [embed] });
    return { ok: false, errorMessage: "already verified" };
  }

  await render({
    embeds: [
      EmbedPresets.registration.userProgress(mcName, steps, currentStep),
    ],
  });

  // Minecraft usernames are 3-16 chars of [a-zA-Z0-9_]. Reject anything else
  // up-front so we don't issue malformed URLs to playerdb.co or leak arbitrary
  // input into downstream services.
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(mcName)) {
    steps[currentStep].error = "Invalid Minecraft username";
    const userErrorEmbed = EmbedPresets.registration.userError(
      mcName,
      "Minecraft usernames can only contain letters, numbers, and underscores (3-16 characters).",
      steps[currentStep].name,
    );
    await render({ embeds: [userErrorEmbed] });
    return { ok: false, errorMessage: "invalid mc name" };
  }

  try {
    await randomDelay();
    let entry = await Q.waitlist.entry.find({ discordId });

    // User joined via the public Discord invite (no waitlist entry exists).
    // Under cap, auto-create one as if they'd just applied. Over cap, require
    // them to apply properly so they go through the normal waitlist email flow.
    if (!entry) {
      const hasCapacity = await waitlistRepo.hasCapacity();
      if (!hasCapacity) {
        steps[currentStep].error = "No waitlist entry found";
        throw new Error(
          "The server is currently at capacity. Please apply at https://createrington.com/apply-to-join to join the waitlist.",
        );
      }
      entry = await waitlistRepo.registerForExistingMember(discordId, username);
    }

    steps[currentStep].completed = true;
    currentStep++;

    await render({
      embeds: [
        EmbedPresets.registration.userProgress(mcName, steps, currentStep),
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

    await render({
      embeds: [
        EmbedPresets.registration.userProgress(correctName, steps, currentStep),
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

    await render({
      embeds: [
        EmbedPresets.registration.userProgress(correctName, steps, currentStep),
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

    await render({
      embeds: [
        EmbedPresets.registration.userProgress(correctName, steps, currentStep),
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

    await render({
      embeds: [
        EmbedPresets.registration.userProgress(correctName, steps, currentStep),
      ],
    });

    await randomDelay();
    await RoleManager.remove(member, Discord.Roles.UNVERIFIED);
    await RoleManager.assign(member, [
      Discord.Roles.VERIFIED,
      Discord.Roles.COGS_AND_STEAM,
    ]);

    try {
      await member.setNickname(correctName, "Registration: sync to MC name");
    } catch (err) {
      // Non-fatal: server owner nicknames can't be set by bots.
      logger.warn(
        `Could not set nickname for ${userTag}: ${err instanceof Error ? err.message : err}`,
      );
    }

    steps[currentStep].completed = true;

    await render({
      embeds: [
        EmbedPresets.registration.userProgress(correctName, steps, currentStep),
      ],
    });

    await randomDelay(500, 1000);

    const autoCloseAt = Math.floor((Date.now() + AUTO_CLOSE_MS) / 1000);
    const { embed, closeButton } = EmbedPresets.registration.userSuccess(
      correctName,
      uuid,
      autoCloseAt,
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      closeButton,
    );

    await render({
      embeds: [embed],
      components: [row],
    });

    logger.info(
      `User ${userTag} (${discordId}) registered as ${correctName} (${uuid})`,
    );

    if (channel) {
      scheduleChannelClose(
        channel,
        AUTO_CLOSE_MS,
        `Registration completed - auto-closed after 24 hours (${userTag})`,
      );
    }

    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("registration failed:", error);

    const adminEmbed = EmbedPresets.registration.adminError(
      mcName,
      userTag,
      discordId,
      errorMessage,
      steps[currentStep]?.name ?? "Unknown step",
    );

    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: adminEmbed.build(),
      content: Discord.Roles.mention(Discord.Roles.ADMIN),
    });

    // Rewind the anchor message back to the idle "click to register" state
    // with the error appended as a field, so the user can retry.
    const idle = buildIdleWelcomeMessage({
      memberMention: `<@${discordId}>`,
      errorMessage,
    });
    await render(idle);

    return { ok: false, errorMessage };
  }
}
