import {
  Client,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextBasedChannel,
  AttachmentBuilder,
} from "discord.js";
import { TicketRepository } from "@/db/repositories/ticket";
import type { Ticket, TicketIdentifier } from "@/generated/db";
import {
  type TicketType,
  TicketStatus,
  type CreateTicketOptions,
  TicketUserAction,
} from "./";
import { getTicketTypeConfig, TicketSystemIds } from "./";
import { Discord } from "@/discord/constants";
import { Q } from "@/db";
import config from "@/config";
import { EmbedPresets } from "@/discord/embeds";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { createTranscript, ExportReturnType } from "discord-html-transcripts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CreateTicketResult {
  ticket: Ticket;
  channel: TextChannel;
}

/**
 * Service for managing Discord support tickets
 * Handles ticket lifecycle including creation, closure, reopening, and deletion
 * Integrates with Discord channels and permissions manager
 */
export class TicketService {
  private readonly transcriptDir: string;
  constructor(
    private readonly bot: Client,
    private readonly repository: TicketRepository = new TicketRepository(),
  ) {
    this.transcriptDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "..",
      "storage",
      "transcripts",
    );
    this.ensureTranscriptDir();
  }

  /**
   * Ensures the transcript directory exists
   *
   * @private
   */
  private async ensureTranscriptDir(): Promise<void> {
    try {
      await fs.mkdir(this.transcriptDir, { recursive: true });
      logger.debug(`Transcript directory ready: ${this.transcriptDir}`);
    } catch (error) {
      logger.error("Failed to create transcript directory:", error);
    }
  }

  /**
   * Creates a new ticket with dedicated Discord channel
   *
   * @param options - Ticket creation options including type and creator ID
   * @returns Promise resolving to the ticket
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

  /**
   * Creates the Discord channel for the ticket
   *
   * @param ticketNumber - Sequential ticket number for naming
   * @param prefix - Channel name prefix from ticket type config
   * @param creatorId - Discord ID of ticket creator
   * @param allowedRoleIds - Role IDs that can access the ticket
   * @returns Promise resolving to the created text channel
   *
   * @private
   */
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

  /**
   * Sends the initial welcome message in the ticket channel
   *
   * @param channel - Discord text channel to send message in
   * @param ticket - Created ticket database record
   * @param creatorId - Discord ID of the ticket creator
   * @returns Promise resolving when the welcome message is sent
   *
   * @private
   */
  private async sendWelcomeMessage(
    channel: TextChannel,
    ticket: Ticket,
    creatorId: string,
  ): Promise<void> {
    const config = getTicketTypeConfig(ticket.type as TicketType);

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

  /**
   * Gets action button row for active ticket management
   *
   * @param ticketId - Database ID of the ticket for button interaction
   * @returns Array containing action row with ticket buttons
   *
   * @private
   */
  private getTicketActionButtons(ticketId: number): any[] {
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
   * Closes an active ticket
   *
   * @param ticketId - Ticket ID to close
   * @param closedBy - Discord ID of user closing the ticket
   * @param generateTranscript - Whether to generate a transcript
   * @returns Promise resolving to the closed ticket
   * @throws Error if ticket is already closed
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

  /**
   * Locks the ticket channel by removing send message permissions
   *
   * @param channelId - Discord channel ID to lock
   * @param creatorId - Discord ID of the ticket creator to remove permissions from
   *
   * @private
   */
  private async lockTicketChannel(
    channelId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const channel = await this.bot.channels.fetch(channelId);
      if (!isSendableChannel(channel)) {
        return;
      }

      const guild = await this.bot.guilds.fetch(config.discord.guild.id);
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

  /**
   * Sends a closure message in the ticket channel
   *
   * @param channelId - Discord channel ID to send message in
   * @param ticket - Ticket database record being closed
   * @param closedBy - Discord ID of user who closed the ticket
   * @returns Promise resolving to the closed message ID, or null
   *
   * @private
   */
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

  /**
   * Creates action button row for closed ticket management
   *
   * @param ticketId - Database ID of the ticket for button interactions
   * @returns Array containing action row with reopen/delete buttons
   *
   * @private
   */
  private getClosedTicketButtons(ticketId: number): any[] {
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

  /**
   * Finds a ticket based on an identifier
   *
   * @param identifier - Identifier of the ticket
   * @returns Promise resolving to the ticket or null
   */
  async find(identifier: TicketIdentifier): Promise<Ticket | null> {
    return await Q.ticket.find(identifier);
  }

  /**
   * Reopens a closed ticket and restores functionality
   *
   * @param ticketId - Ticket ID to reopen
   * @param reopenedBy - Discord ID of user reopening the ticket
   * @returns Promise resolving to the reopened ticket
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

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("🔓 Ticket Reopened")
      .setDescription(
        `This ticket has been reopened by <@${reopenedBy}>.\n\n` +
          `<@${ticket.creatorDiscordId}> can now send messages again.`,
      )
      .setTimestamp();

    await Discord.Messages.send({
      channelId: ticket.channelId,
      embeds: embed,
      components: this.getTicketActionButtons(ticket.id),
    });

    return ticket;
  }

  /**
   * Unlocks the ticket channel by restoring send message permission
   * Re-enables the creator's ability to send messages
   *
   * @param channelId - Discord channel ID to unlock
   * @param creatorId - Discord ID of ticket creator to restore permissions for
   *
   * @private
   */
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
   * Deletes a ticket and its assiciated Discord channel
   * This action cannot be undone
   *
   * @param ticketId - Database ID of the ticket to delete
   * @param deletedBy - Discord user ID of user deleting the ticket
   */
  async deleteTicket(ticketId: number, deletedBy: string): Promise<void> {
    await this.repository.delete(ticketId, deletedBy);
  }

  /**
   * Generates an HTML transcript of ticket conversation
   *
   * @param ticket - Ticket to generate transcript for
   * @returns URL to the transcript
   *
   * @private
   * @todo
   */
  private async generateTranscript(ticket: Ticket): Promise<string> {
    try {
      const channel = await this.bot.channels.fetch(ticket.channelId);

      if (!channel || !isSendableChannel(channel)) {
        throw new Error("Channel not found or is not text-based");
      }

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
   * Sends a generated transcript to the transcript channel
   *
   * @param ticketId - Database ID of the ticket
   * @param generatedBy - Discord ID of user who generated the transcript
   * @returns Promise resolving to the message ID of the transcript message
   * @throws Error if transcript file doesn't exist or channel is not accessible
   */
  async sendTranscript(ticketId: number, generatedBy: string): Promise<string> {
    const ticket = await Q.ticket.get({ id: ticketId });

    const transcriptPath = ticket.metadata?.transcriptPath as
      | string
      | undefined;

    if (!transcriptPath) {
      throw new Error("No transcript found for this ticket");
    }

    try {
      await fs.access(transcriptPath);
    } catch (error) {
      throw new Error("Transcript file not found");
    }

    const transcriptBuffer = await fs.readFile(transcriptPath);
    const attachment = new AttachmentBuilder(transcriptBuffer, {
      name: `ticket-${ticket.ticketNumber}.html`,
    });

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`📄 Ticket #${ticket.ticketNumber} Transcript`)
      .setDescription(
        `**Ticket Type:** ${ticket.type}\n` +
          `**Creator:** <@${ticket.creatorDiscordId}>\n` +
          `**Closed By:** <@${ticket.closedByDiscordId}>\n` +
          `**Generated By:** <@${generatedBy}>\n` +
          `**Channel:** <#${ticket.channelId}>`,
      )
      .addFields(
        {
          name: "Created At",
          value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`,
          inline: true,
        },
        {
          name: "Closed At",
          value: ticket.closedAt
            ? `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:F>`
            : "N/A",
          inline: true,
        },
      )
      .setTimestamp();

    const message = await Discord.Messages.send({
      channelId: TicketSystemIds.TRANSCRIPT_CHANNEL,
      embeds: embed,
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

  /**
   * Checks if a user has an open ticket
   *
   * @param discordId - Discord user ID
   * @returns Promise resolving to true if the user has an open ticket, false otherwise
   */
  async hasOpenTicket(discordId: string): Promise<boolean> {
    return this.repository.hasOpen(discordId);
  }
}
