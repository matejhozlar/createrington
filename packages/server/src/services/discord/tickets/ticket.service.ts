import {
  Client,
  TextChannel,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type PermissionOverwriteOptions,
  type PermissionsString,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextBasedChannel,
  AttachmentBuilder,
} from "discord.js";
import type { Ticket } from "@/generated/db";
import { type CreateTicketOptions, readTicketMetadata } from "./";
import { getTicketTypeConfig, TicketSystemIds } from "./";
import { Discord } from "@/discord/constants";
import { CustomIds } from "@/discord/custom-ids";
import { Q, ticketRepo } from "@/db";
import config from "@/config";
import { EmbedPresets } from "@/discord/embeds";
import path from "node:path";
import fs from "node:fs/promises";
import {
  isGuildTextChannel,
  isSendableChannel,
} from "@/discord/utils/channel-guard";
import { createKeyedLock } from "@/utils/keyed-lock";
const loadTranscripts = () => import("discord-html-transcripts");

const PARTICIPANT_PERMISSIONS = [
  "ViewChannel",
  "SendMessages",
  "ReadMessageHistory",
  "AttachFiles",
  "EmbedLinks",
] as const satisfies readonly PermissionsString[];

const PARTICIPANT_OVERWRITE: PermissionOverwriteOptions = Object.fromEntries(
  PARTICIPANT_PERMISSIONS.map((permission) => [permission, true]),
);

interface CreateTicketResult {
  ticket: Ticket;
  channel: TextChannel;
}

type OpenTicketResult =
  ({ created: true } & CreateTicketResult) | { created: false; ticket: Ticket };

/**
 * Manages the full Discord support-ticket lifecycle: create channel with
 * role-scoped permission overwrites, close (lock + post closure embed),
 * reopen (restore permissions), add or remove participants, delete, and
 * produce HTML transcripts via `discord-html-transcripts`. State is persisted
 * through `TicketRepository`; the transcripts library is loaded lazily because it
 * pulls React 19 while the workspace pins React 18, and the transcripts
 * directory is created (recursively) at construction. Requires the main bot
 * client and is brought up by the service container at startup.
 */
export class TicketService {
  private readonly transcriptDir: string;
  private readonly withCreatorLock = createKeyedLock<string>();
  private readonly withTicketLock = createKeyedLock<number>();
  constructor(private readonly bot: Client) {
    this.transcriptDir = path.join(config.storage.path, "transcripts");
    void this.ensureTranscriptDir();
  }

  private async ensureTranscriptDir(): Promise<void> {
    try {
      await fs.mkdir(this.transcriptDir, { recursive: true });
      logger.debug(`Transcript directory ready: ${this.transcriptDir}`);
    } catch (error) {
      logger.error("Failed to create transcript directory:", error);
    }
  }

  /**
   * Opens a ticket for the creator unless they already have an open one, in
   * which case that ticket is returned with `created: false`. The check and
   * the create run under a per-creator lock, so two requests that arrive
   * together open one ticket. Creating allocates the next ticket number,
   * creates a permission-scoped Discord channel, persists the ticket row and
   * posts the welcome embed. When the row or the welcome embed fails, the
   * channel and the row are discarded so the creator can try again.
   */
  async openTicket(options: CreateTicketOptions): Promise<OpenTicketResult> {
    return this.withCreatorLock(options.creatorId, async () => {
      const [existing] = await Q.ticket.findAll(
        { creatorDiscordId: options.creatorId, status: "open" },
        { limit: 1 },
      );
      if (existing) return { created: false, ticket: existing };

      return { created: true, ...(await this.createTicket(options)) };
    });
  }

  private async createTicket(
    options: CreateTicketOptions,
  ): Promise<CreateTicketResult> {
    const ticketNumber = await Q.ticket.allocateNumber();
    const config = getTicketTypeConfig(options.type);

    const channel = await this.createTicketChannel(
      ticketNumber,
      config.channelPrefix,
      options.creatorId,
      config.allowedRoleIds,
    );

    let ticket: Ticket | null = null;
    try {
      ticket = await ticketRepo.create({
        ticketNumber,
        type: options.type,
        creatorDiscordId: options.creatorId,
        channelId: channel.id,
      });

      await this.sendWelcomeMessage(channel, ticket, options.creatorId);
    } catch (error) {
      await this.discardTicket(channel, ticket);
      throw error;
    }

    logger.info(
      `Created ticket #${ticketNumber} (ID: ${ticket.id}) for user ${options.creatorId}`,
    );

    return { ticket, channel };
  }

  private async discardTicket(
    channel: TextChannel,
    ticket: Ticket | null,
  ): Promise<void> {
    if (ticket) {
      try {
        await ticketRepo.delete(
          ticket.id,
          this.bot.user?.id ?? ticket.creatorDiscordId,
        );
      } catch (error) {
        logger.error(
          `Failed to discard ticket ${ticket.id} after a failed create:`,
          error,
        );
      }
    }

    try {
      await channel.delete("Ticket creation failed");
    } catch (error) {
      logger.error(
        `Failed to delete channel ${channel.id} after a failed ticket create:`,
        error,
      );
    }
  }

  private async createTicketChannel(
    ticketNumber: number,
    prefix: string,
    creatorId: string,
    allowedRoleIds: string[],
  ): Promise<TextChannel> {
    const guild = await this.bot.guilds.fetch(config.discord.guild.id);

    const channelName = `${prefix}-${ticketNumber.toString().padStart(4, "0")}`;

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: creatorId,
        allow: [...PARTICIPANT_PERMISSIONS],
      },
      ...allowedRoleIds.map((roleId) => ({
        id: roleId,
        allow: [...PARTICIPANT_PERMISSIONS, "ManageMessages" as const],
      })),
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TicketSystemIds.TICKET_CATEGORY,
      permissionOverwrites,
    });

    return channel;
  }

  private async sendWelcomeMessage(
    channel: TextChannel,
    ticket: Ticket,
    creatorId: string,
  ): Promise<void> {
    const player = await Q.player.find(
      { discordId: creatorId },
      { select: ["minecraftUsername"] },
    );

    const embed = EmbedPresets.ticket.welcome(
      creatorId,
      player?.minecraftUsername ?? null,
    );

    await Discord.Messages.send({
      channelId: channel.id,
      embeds: embed.build(),
      components: this.getTicketActionButtons(ticket.id),
    });
  }

  private getTicketActionButtons(
    ticketId: number,
  ): ActionRowBuilder<ButtonBuilder>[] {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            CustomIds.ticket.build({ action: "close", target: ticketId }),
          )
          .setStyle(ButtonStyle.Danger)
          .setLabel("Close")
          .setEmoji("🔒"),
      ),
    ];
  }

  /**
   * Close an active ticket: mark the row closed, lock the channel for the
   * creator, drop everyone added to it afterwards, and post the closure
   * embed. A closed ticket whose closure embed was never posted gets it
   * posted again instead. Throws if the ticket is already closed with its
   * closure embed in place. Runs under a per-ticket lock.
   */
  async closeTicket(ticketId: number, closedBy: string): Promise<Ticket> {
    return this.withTicketLock(ticketId, async () => {
      const current = await Q.ticket.get({ id: ticketId });
      const ticket = this.isMissingClosureMessage(current)
        ? current
        : await ticketRepo.close(ticketId, closedBy);

      await this.lockTicketChannel(ticket.channelId, ticket.creatorDiscordId);

      const closeMessageId = await this.sendClosureMessage(
        ticket.channelId,
        ticket,
        ticket.closedByDiscordId ?? closedBy,
      );

      await ticketRepo.updateMetadata(ticketId, { closeMessageId });

      return ticket;
    });
  }

  /** Whether the ticket is closed without its closure embed (the send failed after the row was closed), so `closeTicket` can post it again. */
  isMissingClosureMessage(ticket: Ticket): boolean {
    return (
      ticket.status === "closed" &&
      !readTicketMetadata(ticket.metadata).closeMessageId
    );
  }

  private async lockTicketChannel(
    channelId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (!isGuildTextChannel(channel)) {
        return;
      }

      await channel.permissionOverwrites.edit(
        creatorId,
        {
          ViewChannel: false,
          SendMessages: false,
        },
        { type: OverwriteType.Member },
      );

      const participants = channel.permissionOverwrites.cache.filter(
        (overwrite) =>
          overwrite.type === OverwriteType.Member && overwrite.id !== creatorId,
      );

      for (const overwrite of participants.values()) {
        try {
          await overwrite.delete();
        } catch (error) {
          logger.error(
            `Failed to remove ${overwrite.id} from ticket channel ${channelId}:`,
            error,
          );
        }
      }

      logger.debug(
        `Locked ticket channel ${channelId}, removed creator ${creatorId} and ${participants.size} added participant(s)`,
      );
    } catch (error) {
      logger.error(`Failed to lock ticket channel ${channelId}:`, error);
    }
  }

  private async sendClosureMessage(
    channelId: string,
    ticket: Ticket,
    closedBy: string,
  ): Promise<string> {
    const embed = EmbedPresets.ticket.close(closedBy);

    const message = await Discord.Messages.send({
      channelId,
      embeds: embed.build(),
      components: this.getClosedTicketButtons(ticket.id),
    });

    return message.id;
  }

  private getClosedTicketButtons(
    ticketId: number,
  ): ActionRowBuilder<ButtonBuilder>[] {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            CustomIds.ticket.build({ action: "reopen", target: ticketId }),
          )
          .setLabel("Reopen Ticket")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🔓"),
        new ButtonBuilder()
          .setCustomId(
            CustomIds.ticket.build({ action: "transcript", target: ticketId }),
          )
          .setLabel("Transcript")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("📄"),
        new ButtonBuilder()
          .setCustomId(
            CustomIds.ticket.build({ action: "delete", target: ticketId }),
          )
          .setLabel("Delete Ticket")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  /**
   * Reopen a closed ticket: delete the stored closure message, restore the
   * creator's channel permissions, and post the reopen embed with active
   * action buttons.
   */
  async reopenTicket(ticketId: number, reopenedBy: string): Promise<Ticket> {
    const ticket = await ticketRepo.reopen(ticketId, reopenedBy);

    const { closeMessageId } = readTicketMetadata(ticket.metadata);
    if (closeMessageId) {
      try {
        await Discord.Messages.delete({
          channelId: ticket.channelId,
          messageId: closeMessageId,
        });
      } catch (error) {
        logger.warn(`Failed to delete close message ${closeMessageId}:`, error);
      }
    }

    await this.unlockTicketChannel(ticket.channelId, ticket.creatorDiscordId);

    const embed = EmbedPresets.ticket.reopen(
      reopenedBy,
      ticket.creatorDiscordId,
    );

    await Discord.Messages.send({
      channelId: ticket.channelId,
      embeds: embed.build(),
      components: this.getTicketActionButtons(ticket.id),
    });

    return ticket;
  }

  private async unlockTicketChannel(
    channelId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (!isGuildTextChannel(channel)) return;

      const guild = await this.bot.guilds.fetch(config.discord.guild.id);
      const member = await guild.members.fetch(creatorId).catch(() => null);

      if (!member) {
        logger.warn(`Creator ${creatorId} not found in guild, skipping unlock`);
        return;
      }

      await channel.permissionOverwrites.edit(member, PARTICIPANT_OVERWRITE);

      logger.debug(
        `Unlocked ticket channel ${channelId} for creator ${creatorId}`,
      );
    } catch (error) {
      logger.error(`Failed to unlock ticket channel ${channelId}:`, error);
    }
  }

  /**
   * Grants Discord users view + send permissions on a ticket channel.
   * Resolves the channel and guild once and loops sequentially so
   * permission-overwrite writes for the same channel queue cleanly under
   * discord.js rate limiting. Never throws on per-user issues so callers
   * can pass a batch and aggregate skips.
   */
  async addParticipants(
    channelId: string,
    discordIds: readonly string[],
  ): Promise<
    Map<string, { added: boolean; reason?: "not-in-guild" | "channel-error" }>
  > {
    const results = new Map<
      string,
      { added: boolean; reason?: "not-in-guild" | "channel-error" }
    >();
    if (discordIds.length === 0) return results;

    let textChannel: TextChannel;
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (channel?.type !== ChannelType.GuildText) {
        for (const id of discordIds) {
          results.set(id, { added: false, reason: "channel-error" });
        }
        return results;
      }
      textChannel = channel;
    } catch (error) {
      logger.error(`Failed to resolve ticket channel ${channelId}:`, error);
      for (const id of discordIds) {
        results.set(id, { added: false, reason: "channel-error" });
      }
      return results;
    }

    const guild = await this.bot.guilds.fetch(config.discord.guild.id);

    for (const discordId of discordIds) {
      try {
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          results.set(discordId, { added: false, reason: "not-in-guild" });
          continue;
        }

        await textChannel.permissionOverwrites.edit(
          member,
          PARTICIPANT_OVERWRITE,
        );

        logger.debug(`Added ${discordId} to ticket channel ${channelId}`);
        results.set(discordId, { added: true });
      } catch (error) {
        logger.error(
          `Failed to add ${discordId} to ticket channel ${channelId}:`,
          error,
        );
        results.set(discordId, { added: false, reason: "channel-error" });
      }
    }

    return results;
  }

  /** Single-user convenience wrapper around `addParticipants`. */
  async addParticipant(
    channelId: string,
    discordId: string,
  ): Promise<{ added: boolean; reason?: "not-in-guild" | "channel-error" }> {
    const results = await this.addParticipants(channelId, [discordId]);
    return results.get(discordId) ?? { added: false, reason: "channel-error" };
  }

  /**
   * Revokes a user's own access to a ticket channel by deleting their
   * permission overwrite. Works for users who already left the guild, and
   * leaves role-based access (staff) untouched. Never throws.
   */
  async removeParticipant(
    channelId: string,
    discordId: string,
  ): Promise<{
    removed: boolean;
    reason?: "not-participant" | "channel-error";
  }> {
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (channel?.type !== ChannelType.GuildText) {
        return { removed: false, reason: "channel-error" };
      }

      const textChannel = channel;
      if (!textChannel.permissionOverwrites.cache.has(discordId)) {
        return { removed: false, reason: "not-participant" };
      }

      await textChannel.permissionOverwrites.delete(discordId);

      logger.debug(`Removed ${discordId} from ticket channel ${channelId}`);
      return { removed: true };
    } catch (error) {
      logger.error(
        `Failed to remove ${discordId} from ticket channel ${channelId}:`,
        error,
      );
      return { removed: false, reason: "channel-error" };
    }
  }

  /** Permanently delete a ticket and its Discord channel. Cannot be undone. */
  async deleteTicket(ticketId: number, deletedBy: string): Promise<void> {
    await ticketRepo.delete(ticketId, deletedBy);
  }

  /**
   * Return the ticket's stored transcript path, generating and storing a new
   * transcript first when it has none or its file is gone. `generated` says
   * which happened.
   */
  async ensureTranscript(
    ticketId: number,
  ): Promise<{ transcriptPath: string; generated: boolean }> {
    const ticket = await Q.ticket.get({ id: ticketId });
    const { transcriptPath: stored } = readTicketMetadata(ticket.metadata);

    if (stored && (await this.fileExists(stored))) {
      return { transcriptPath: stored, generated: false };
    }

    const transcriptPath = await this.generateTranscript(ticket);
    await ticketRepo.updateMetadata(ticketId, { transcriptPath });

    return { transcriptPath, generated: true };
  }

  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  private async generateTranscript(ticket: Ticket): Promise<string> {
    try {
      const channel = await this.bot.channels.fetch(ticket.channelId);

      if (!channel || !isSendableChannel(channel)) {
        throw new Error("Channel not found or is not text-based");
      }

      const filename = `ticket-${ticket.ticketNumber}-${Date.now()}.html`;
      const { createTranscript, ExportReturnType } = await loadTranscripts();
      const transcript = await createTranscript(channel as TextBasedChannel, {
        limit: -1,
        returnType: ExportReturnType.Buffer,
        filename,
        saveImages: true,
        poweredBy: false,
      });

      const filepath = path.join(this.transcriptDir, filename);

      await fs.writeFile(filepath, transcript);

      logger.info(
        `Generated transcript for ticket #${ticket.ticketNumber}: ${filepath}`,
      );

      return filepath;
    } catch (error) {
      logger.error(
        `Failed to generate transcript for ticket ${ticket.id}:`,
        error,
      );
      throw new Error("Failed to generate transcript");
    }
  }

  /**
   * Post a previously generated transcript file to the transcript channel
   * and log the action. Throws if the ticket has no stored transcript, the
   * path escapes the transcripts directory, or the file is missing.
   */
  async sendTranscript(ticketId: number, generatedBy: string): Promise<string> {
    const ticket = await Q.ticket.get({ id: ticketId });

    const { transcriptPath } = readTicketMetadata(ticket.metadata);

    if (!transcriptPath) {
      throw new Error("No transcript found for this ticket");
    }

    const resolvedPath = path.resolve(transcriptPath);
    const resolvedDir = path.resolve(this.transcriptDir);
    if (
      resolvedPath !== resolvedDir &&
      !resolvedPath.startsWith(resolvedDir + path.sep)
    ) {
      throw new Error("Transcript path outside transcripts directory");
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      throw new Error("Transcript file not found");
    }

    const transcriptBuffer = await fs.readFile(resolvedPath);
    const attachment = new AttachmentBuilder(transcriptBuffer, {
      name: `ticket-${ticket.ticketNumber}.html`,
    });

    const embed = EmbedPresets.ticket.transcript({
      ticketNumber: ticket.ticketNumber,
      type: ticket.type,
      creatorDiscordId: ticket.creatorDiscordId,
      closedByDiscordId: ticket.closedByDiscordId!,
      generatedBy,
      channelId: ticket.channelId,
      createdAt: ticket.createdAt,
      closedAt: ticket.closedAt,
    });

    const message = await Discord.Messages.send({
      channelId: TicketSystemIds.TRANSCRIPT_CHANNEL,
      embeds: embed.build(),
      files: [attachment],
    });

    await Q.ticket.action.create({
      ticketId,
      actionType: "transcript_generated",
      performedByDiscordId: generatedBy,
      metadata: {
        transcriptMessageId: message.id,
        transcriptChannelId: TicketSystemIds.TRANSCRIPT_CHANNEL,
      },
    });

    logger.info(
      `Sent transcript for ticket #${ticket.ticketNumber} to transcript channel`,
    );

    return message.id;
  }
}
