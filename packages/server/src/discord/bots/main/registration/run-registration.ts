import { Q, waitlistRepo } from "@/db";
import { waitlistService } from "@/services/waitlist/waitlist.service";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import {
  RegistrationComponentPresets,
  type RegistrationMessage,
} from "@/discord/components/presets/registration";
import {
  AUTO_CLOSE_MS,
  scheduleChannelClose,
} from "@/discord/bots/main/registration-cleanup";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import type { GuildMember, GuildTextBasedChannel } from "discord.js";
import { postRegistrationWelcomeCard } from "./post-welcome-card";

/** Minimal shape each entry point (slash command, modal submit) supplies so the
 * core flow can render the Components V2 card without caring where it lands. */
export type RegistrationRenderer = (
  payload: RegistrationMessage,
) => Promise<void>;

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
    await render(
      RegistrationComponentPresets.errorWithAdmin(
        "Registration Failed",
        "Could not verify your roles. Please try again.",
      ),
    );
    return { ok: false, errorMessage: "roles unavailable" };
  }

  if (!RoleManager.has(member, Discord.Roles.UNVERIFIED)) {
    await render(
      RegistrationComponentPresets.error(
        "Already Registered",
        "You are already verified or not eligible to register",
      ),
    );
    return { ok: false, errorMessage: "already verified" };
  }

  await render(
    RegistrationComponentPresets.progress(mcName, steps, currentStep),
  );

  // Minecraft usernames are 3-16 chars of [a-zA-Z0-9_]. Reject anything else
  // up-front so we don't issue malformed URLs to playerdb.co or leak arbitrary
  // input into downstream services.
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(mcName)) {
    await render(
      RegistrationComponentPresets.idle({
        memberMention: `<@${discordId}>`,
        errorMessage:
          "Minecraft usernames can only contain letters, numbers, and underscores (3-16 characters).",
      }),
    );
    return { ok: false, errorMessage: "invalid mc name" };
  }

  try {
    await randomDelay();
    let entry = await Q.waitlist.entry.find({ discordId });

    if (!entry) {
      const hasCapacity = await waitlistRepo.hasCapacity();
      if (!hasCapacity) {
        steps[currentStep].error = "Server at capacity";
        throw new Error(
          "The server is currently at capacity. Use the **Join Waitlist** button in your verification channel to get in line.",
        );
      }
      entry = await waitlistService.createPromotedForExistingMember(
        discordId,
        username,
      );
    } else if (entry.status === "queued" || entry.status === "expired") {
      const hasCapacity = await waitlistRepo.hasCapacity();
      if (!hasCapacity) {
        steps[currentStep].error = "Not promoted from the waitlist";
        throw new Error(
          entry.status === "queued"
            ? "The server is currently at capacity and you're still in the queue. We'll ping you right here when a spot opens up."
            : "The server is currently at capacity. Use the **Join Waitlist** button in your verification channel to get in line.",
        );
      }
    }

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(mcName, steps, currentStep),
    );

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

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

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

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    try {
      await minecraftRcon.whitelistAll(WhitelistAction.ADD, correctName);
    } catch (error) {
      steps[currentStep].error = "Failed to add to whitelist";
      throw new Error(`Failed to whitelist ${correctName}: ${error}`);
    }

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    await Q.player.create({
      minecraftUuid: uuid,
      minecraftUsername: correctName,
      discordId,
    });
    await Q.player.balance.create({
      minecraftUuid: uuid,
    });

    await waitlistService.markRegistered(entry.id);

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    await RoleManager.remove(member, Discord.Roles.UNVERIFIED);
    await RoleManager.assign(member, [
      Discord.Roles.VERIFIED,
      Discord.Roles.COGS_AND_STEAM,
    ]);

    try {
      await member.setNickname(correctName, "Registration: sync to MC name");
    } catch (error) {
      // Non-fatal: server owner nicknames can't be set by bots.
      logger.warn(
        `Could not set nickname for ${userTag}: ${error instanceof Error ? error.message : error}`,
      );
    }

    steps[currentStep].completed = true;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay(500, 1000);

    const autoCloseAt = Math.floor((Date.now() + AUTO_CLOSE_MS) / 1000);

    await render(
      RegistrationComponentPresets.success(correctName, uuid, autoCloseAt),
    );

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

    void postRegistrationWelcomeCard({
      member,
      discordId,
      minecraftUuid: uuid,
      minecraftUsername: correctName,
    });

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
    // with the error appended, so the user can retry.
    await render(
      RegistrationComponentPresets.idle({
        memberMention: `<@${discordId}>`,
        errorMessage,
      }),
    );

    return { ok: false, errorMessage };
  }
}
