import {
  Client,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextBasedChannel,
  AttachmentBuilder,
} from "discord.js";
import { TicketRepository } from "@/db/repositories/ticket";
import type { Ticket, TicketIdentifier } from "@/generated/db";
import { TicketStatus, type CreateTicketOptions, TicketUserAction } from "./";
import { getTicketTypeConfig, TicketSystemIds } from "./";
import { Discord } from "@/discord/constants";
import { Q } from "@/db";
import config from "@/config";
import { EmbedPresets } from "@/discord/embeds";
import path from "node:path";
import fs from "node:fs/promises";
import { isSendableChannel } from "@/discord/utils/channel-guard";
// Lazy-imported to avoid React 19/18 conflict at startup
// discord-html-transcripts requires react-dom/static (React 19) but the workspace pins React 18
const loadTranscripts = () => import("discord-html-transcripts");

interface CreateTicketResult {
  ticket: Ticket;
  channel: TextChannel;
}

/**
 * Manages the full Discord support-ticket lifecycle: create channel with
 * role-scoped permission overwrites, close (lock + post closure embed),
 * reopen (restore permissions), add participants, delete, and produce HTML
 * transcripts via `discord-html-transcripts`. State is persisted through
 * `TicketRepository`; the transcripts library is loaded lazily because it
 * pulls React 19 while the workspace pins React 18, and the transcripts
 * directory is created (recursively) at construction. Requires the main bot
 * client and is brought up by the service container at startup.
 */
export class TicketService {
  private readonly transcriptDir: string;
  constructor(
    private readonly bot: Client,
    private readonly repository: TicketRepository = new TicketRepository(),
  ) {
    this.transcriptDir = path.join(config.storage.path, "transcripts");
    this.ensureTranscriptDir();
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
   * Allocate the next ticket number, create a permission-scoped Discord
   * channel, persist the ticket row, and post the welcome embed.
   */
  async createTicket(
    options: CreateTicketOptions,
  ): Promise<CreateTicketResult> {
    const ticketNumber = await this.repository.getNext();
    const config = getTicketTypeConfig(options.type);

    const channel = await this.createTicketChannel(
      ticketNumber,
      config.channelPrefix,
      options.creatorId,
      config.allowedRoleIds,
    );

    const ticket = await this.repository.create({
      ticketNumber,
      type: options.type,
      creatorDiscordId: options.creatorId,
      channelId: channel.id,
    });

    await this.sendWelcomeMessage(channel, ticket, options.creatorId);

    logger.info(
      `Created ticket #${ticketNumber} (ID: ${ticket.id}) for user ${options.creatorId}`,
    );

    return { ticket, channel };
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
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      ...allowedRoleIds.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TicketSystemIds.TICKET_CATEGORY,
      permissionOverwrites,
    });

    return channel as TextChannel;
  }

  private async sendWelcomeMessage(
    channel: TextChannel,
    ticket: Ticket,
    creatorId: string,
  ): Promise<void> {
    const minecraftUsername = await Q.player.select.minecraftUsername({
      discordId: creatorId,
    });

    const embed = EmbedPresets.ticket.welcome(creatorId, minecraftUsername);

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
          .setCustomId(`ticket:close:${ticketId}`)
          .setStyle(ButtonStyle.Danger)
          .setLabel("Close")
          .setEmoji("🔒"),
      ),
    ];
  }

  /**
   * Close an active ticket: optionally write a transcript, mark the row
   * closed, lock the channel for the creator, and post the closure embed.
   * Throws if the ticket is already closed.
   */
  async closeTicket(
    ticketId: number,
    closedBy: string,
    generateTranscript: boolean = false,
  ): Promise<Ticket> {
    const ticket = await Q.ticket.get({ id: ticketId });

    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error(`Ticket #${ticket.ticketNumber} is already closed`);
    }

    let transcriptPath: string | undefined;

    if (generateTranscript) {
      transcriptPath = await this.generateTranscript(ticket);
    }

    const updatedTicket = await this.repository.close(ticketId, {
      closedByDiscordId: closedBy,
      transcriptPath,
    });

    await this.lockTicketChannel(ticket.channelId, ticket.creatorDiscordId);

    const closeMessageId = await this.sendClosureMessage(
      ticket.channelId,
      updatedTicket,
      closedBy,
    );

    if (closeMessageId) {
      await this.repository.updateMetadata(ticketId, {
        closeMessageId,
      });
    }

    return updatedTicket;
  }

  private async lockTicketChannel(
    channelId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (!isSendableChannel(channel)) {
        return;
      }

      await this.bot.guilds.fetch(config.discord.guild.id);
      const textChannel = channel as TextChannel;

      await textChannel.permissionOverwrites.edit(creatorId, {
        ViewChannel: false,
        SendMessages: false,
      });

      logger.debug(
        `Locked ticket channel ${channelId} and removed creator ${creatorId}`,
      );
    } catch (error) {
      logger.error(`Failed to lock ticket channel ${channelId}:`, error);
    }
  }

  private async sendClosureMessage(
    channelId: string,
    ticket: Ticket,
    closedBy: string,
  ): Promise<string | null> {
    const embed = EmbedPresets.ticket.close(closedBy);

    const message = await Discord.Messages.send({
      channelId,
      embeds: embed.build(),
      components: this.getClosedTicketButtons(ticket.id),
    });

    return message.messageId || null;
  }

  private getClosedTicketButtons(
    ticketId: number,
  ): ActionRowBuilder<ButtonBuilder>[] {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:reopen:${ticketId}`)
          .setLabel("Reopen Ticket")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🔓"),
        new ButtonBuilder()
          .setCustomId(`ticket:transcript:${ticketId}`)
          .setLabel("Transcript")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("📄"),
        new ButtonBuilder()
          .setCustomId(`ticket:delete:${ticketId}`)
          .setLabel("Delete Ticket")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }

  /** Look up a ticket by any supported identifier, or null if not found. */
  async find(identifier: TicketIdentifier): Promise<Ticket | null> {
    return await Q.ticket.find(identifier);
  }

  /**
   * Reopen a closed ticket: delete the stored closure message, restore the
   * creator's channel permissions, and post the reopen embed with active
   * action buttons.
   */
  async reopenTicket(ticketId: number, reopenedBy: string): Promise<Ticket> {
    const ticket = await this.repository.reopen(ticketId, reopenedBy);

    const closeMessageId = ticket.metadata?.closeMessageId;
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
      if (!channel?.isTextBased()) return;

      const guild = await this.bot.guilds.fetch(config.discord.guild.id);
      const textChannel = channel as TextChannel;

      const member = await guild.members.fetch(creatorId).catch(() => null);

      if (!member) {
        logger.warn(`Creator ${creatorId} not found in guild, skipping unlock`);
        return;
      }

      await textChannel.permissionOverwrites.edit(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      });

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
      textChannel = channel as TextChannel;
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

        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        });

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

  /** Permanently delete a ticket and its Discord channel. Cannot be undone. */
  async deleteTicket(ticketId: number, deletedBy: string): Promise<void> {
    await this.repository.delete(ticketId, deletedBy);
  }

  private async generateTranscript(ticket: Ticket): Promise<string> {
    try {
      const channel = await this.bot.channels.fetch(ticket.channelId);

      if (!channel || !isSendableChannel(channel)) {
        throw new Error("Channel not found or is not text-based");
      }

      const { createTranscript, ExportReturnType } = await loadTranscripts();
      const transcript = await createTranscript(channel as TextBasedChannel, {
        limit: -1,
        returnType: ExportReturnType.Buffer,
        filename: `ticket-${ticket.ticketNumber}-${Date.now()}.html`,
        saveImages: true,
        poweredBy: false,
      });

      const filename = `ticket-${ticket.ticketNumber}-${Date.now()}.html`;
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

    const transcriptPath = ticket.metadata?.transcriptPath as
      | string
      | undefined;

    if (!transcriptPath) {
      throw new Error("No transcript found for this ticket");
    }

    // transcriptPath comes from ticket.metadata (JSONB) which is only written
    // by generateTranscript today, but the column has no schema. If any
    // future path writes user input into metadata.transcriptPath, this
    // fs.readFile becomes an arbitrary-file-read primitive. Pin it to the
    // transcripts dir.
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

    await this.repository.logAction({
      ticketId,
      actionType: TicketUserAction.TRANSCRIPT_GENERATED,
      performedByDiscordId: generatedBy,
      metadata: {
        transcriptMessageId: message.messageId,
        transcriptChannelId: TicketSystemIds.TRANSCRIPT_CHANNEL,
      },
    });

    logger.info(
      `Sent transcript for ticket #${ticket.ticketNumber} to transcript channel`,
    );

    return message.messageId!;
  }

  /** True if the user currently has any non-closed ticket. */
  async hasOpenTicket(discordId: string): Promise<boolean> {
    return this.repository.hasOpen(discordId);
  }
}
