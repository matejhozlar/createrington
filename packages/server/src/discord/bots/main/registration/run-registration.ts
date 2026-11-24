import { roleMention, userMention } from "discord.js";
import { db, Q } from "@/db";
import { updateProgressEmbed } from "@/services/waitlist/progress-embed";
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
import { getSkinApiClient } from "@/services/skin-api/client";
import { BadRequestError, errorMessage } from "@/errors";
import { MC_USERNAME_REGEX } from "@/utils/zod-schemas";
import { createKeyedLock } from "@/utils/keyed-lock";
import { SkinApiError, type ResolvedPlayer } from "createrington-skin-api";
import type { GuildMember, GuildTextBasedChannel } from "discord.js";
import type { WaitlistEntry } from "@createrington/shared/db";
import { postRegistrationWelcomeCard } from "./post-welcome-card";
import { isVerificationChannel } from "./verification-channel";

const GENERIC_FAILURE_MESSAGE =
  "Something went wrong on our side. An admin has been notified; please try again in a few minutes.";

export type RegistrationRenderer = (
  payload: RegistrationMessage,
) => Promise<void>;

function randomDelay(min = 1000, max = 3000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RegistrationError extends Error {}

const withRegistrationLock = createKeyedLock<string>();

interface RegistrationStep {
  name: string;
  completed: boolean;
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

interface RegistrationParams {
  member: GuildMember;
  discordId: string;
  userTag: string;
  username: string;
  mcName: string;
  channel: GuildTextBasedChannel | null;
  render: RegistrationRenderer;
}

export function runRegistration(
  params: RegistrationParams,
): Promise<RegistrationResult> {
  return withRegistrationLock(params.discordId, () => register(params));
}

async function register(
  params: RegistrationParams,
): Promise<RegistrationResult> {
  const { member, discordId, userTag, username, mcName, channel, render } =
    params;
  const verifyChannel = isVerificationChannel(channel) ? channel : null;

  const steps = STEPS.map((s) => ({ ...s }));
  let currentStep = 0;

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

  if (!MC_USERNAME_REGEX.test(mcName)) {
    await render(
      RegistrationComponentPresets.idle({
        memberMention: userMention(discordId),
        errorMessage:
          "Minecraft usernames can only contain letters, numbers, and underscores (1-16 characters).",
      }),
    );
    return { ok: false, errorMessage: "invalid mc name" };
  }

  let entry: WaitlistEntry | null = null;
  let reservedHere = false;
  let whitelistedName: string | null = null;

  try {
    await randomDelay();
    if (await Q.player.exists({ discordId })) {
      throw new RegistrationError(
        "This Discord account is already registered.",
      );
    }

    entry = await Q.waitlist.entry.find({ discordId });

    if (entry?.status === "queued") {
      throw new RegistrationError(
        "You're in the waitlist queue. We'll ping you right here as soon as it's your turn to register.",
      );
    }

    const reservation = await waitlistService.reserveForDirectRegistration(
      discordId,
      username,
      verifyChannel?.id ?? null,
    );
    if (!reservation) {
      throw new RegistrationError(
        "The server is currently at capacity. Use the **Join Waitlist** button in your verification channel to get in line.",
      );
    }
    entry = reservation.entry;
    reservedHere = reservation.reserved;

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(mcName, steps, currentStep),
    );

    await randomDelay();

    let profile: ResolvedPlayer;
    try {
      profile = await getSkinApiClient().resolve({ username: mcName });
    } catch (error) {
      if (error instanceof SkinApiError && error.status === 404) {
        throw new RegistrationError(
          `No Minecraft account found with the name \`${mcName}\``,
        );
      }
      throw error;
    }

    const uuid = profile.uuid;
    const correctName = profile.username ?? mcName;

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    const exists = await Q.player.exists({ minecraftUuid: uuid });

    if (exists) {
      throw new RegistrationError(
        `This Minecraft account (\`${correctName}\`) is already registered`,
      );
    }

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    whitelistedName = correctName;
    try {
      await minecraftRcon.whitelistAll(WhitelistAction.ADD, correctName);
    } catch (error) {
      throw new Error(`Failed to whitelist ${correctName}: ${error}`);
    }

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    const entryId = entry.id;
    await db.inTransaction(async (tx) => {
      await tx.player.create({
        minecraftUuid: uuid,
        minecraftUsername: correctName,
        discordId,
      });
      await tx.player.balance.create({
        minecraftUuid: uuid,
      });
      await tx.player.vote.linkUsername(correctName, uuid);
      await tx.waitlist.entry.update(
        { id: entryId },
        { status: "registered", registeredAt: new Date() },
      );
    });
    reservedHere = false;
    whitelistedName = null;

    await updateProgressEmbed(entryId);

    steps[currentStep].completed = true;
    currentStep++;

    await render(
      RegistrationComponentPresets.progress(correctName, steps, currentStep),
    );

    await randomDelay();
    await RoleManager.remove(member, Discord.Roles.UNVERIFIED);
    await RoleManager.assign(member, Discord.Roles.VERIFIED);

    try {
      await member.setNickname(correctName, "Registration: sync to MC name");
    } catch (error) {
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

    if (verifyChannel) {
      scheduleChannelClose(
        verifyChannel,
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
    const failure = errorMessage(error);
    const memberMessage =
      error instanceof RegistrationError || error instanceof BadRequestError
        ? error.message
        : GENERIC_FAILURE_MESSAGE;
    const failedStep = steps[currentStep]?.name ?? "Unknown step";
    logger.error("registration failed:", error);

    if (whitelistedName) {
      try {
        await minecraftRcon.whitelistAll(
          WhitelistAction.REMOVE,
          whitelistedName,
        );
      } catch (removeError) {
        logger.error(
          `Could not remove ${whitelistedName} from the whitelist after the failed registration:`,
          removeError,
        );
      }
    }

    if (reservedHere && entry) {
      try {
        await waitlistService.releaseReservation(entry.id);
      } catch (releaseError) {
        logger.error(
          `Could not release waitlist reservation for entry #${entry.id}:`,
          releaseError,
        );
      }
    }

    const adminEmbed = EmbedPresets.registration.adminError(
      mcName,
      userTag,
      discordId,
      failure,
      failedStep,
    );

    await Discord.Messages.send({
      channelId: Discord.Channels.administration.NOTIFICATIONS,
      embeds: adminEmbed.build(),
      content: roleMention(Discord.Roles.ADMIN),
      allowedMentions: { roles: [Discord.Roles.ADMIN] },
    }).catch((error: unknown) => {
      logger.error(
        "Could not alert admins about the failed registration:",
        error,
      );
    });

    await render(
      RegistrationComponentPresets.idle({
        memberMention: userMention(discordId),
        errorMessage: memberMessage,
        failedStep,
      }),
    );

    return { ok: false, errorMessage: memberMessage };
  }
}
