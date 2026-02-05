import {
  TicketStatus,
  TicketType,
  TicketUserAction,
} from "@/services/discord/tickets";
import type {
  Ticket,
  TicketAction,
  TicketActionCreate,
  TicketCreate,
} from "@/generated/db";
import { DatabaseTable } from "@/generated/db";
import { Q } from "@/db";

interface TicketCloseData {
  closedByDiscordId: string;
  transcriptPath?: string;
}

export class TicketRepository {
  /**
   * Gets the next available ticket number
   *
   * @returns Promise resolving to the next ticket number
   */
  async getNext(): Promise<number> {
    return await Q.ticket.getNext();
  }

  /**
   * Creates a new ticket in the database
   *
   * @param data - Ticket creation data
   * @returns Promise resolving to the created ticket
   */
  async create(data: TicketCreate): Promise<Ticket> {
    const ticketNumber = await this.getNext();

    const ticket = await Q.ticket.createAndReturn({
      ticketNumber,
      type: data.type,
      creatorDiscordId: data.creatorDiscordId,
      channelId: data.channelId,
      status: TicketStatus.OPEN,
      metadata: data.metadata || {},
    });

    await this.logAction({
      ticketId: ticket.id,
      actionType: TicketUserAction.CREATED,
      performedByDiscordId: data.creatorDiscordId,
      metadata: {
        ticketNumber,
        type: data.type,
        channelId: data.channelId,
      },
    });

    logger.info(
      `Created ticket #${ticketNumber} (ID: ${ticket.id}) for user ${data.creatorDiscordId}`,
    );

    return ticket;
  }

  /**
   * Closes a ticket in the database
   *
   * @param ticketId - Ticket ID to close
   * @param data - Close ticket data
   * @returns Promise resolving to the updated ticket
   */
  async close(ticketId: number, data: TicketCloseData): Promise<Ticket> {
    const ticket = await Q.ticket.get({ id: ticketId });

    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error(`Ticket #${ticket.ticketNumber} is already closed`);
    }

    const updatedTicket = await Q.ticket.updateAndReturn(
      { id: ticketId },
      {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
        closedByDiscordId: data.closedByDiscordId,
        metadata: {
          ...ticket.metadata,
          transcriptUrl: data.transcriptPath,
        },
      },
    );

    await this.logAction({
      ticketId,
      actionType: TicketUserAction.CLOSED,
      performedByDiscordId: data.closedByDiscordId,
      metadata: {
        transcriptUrl: data.transcriptPath,
      },
    });

    logger.info(
      `Closed ticket #${ticket.ticketNumber} (ID: ${ticketId}) by user ${data.closedByDiscordId}`,
    );

    return updatedTicket;
  }

  /**
   * Reopens a closed ticked in the database
   *
   * @param ticketId - Ticket ID to reopen
   * @param reopenedBy - Discord ID of user reopening the ticket
   * @returns Promise resolving to the updated ticket
   */
  async reopen(ticketId: number, reopenedBy: string): Promise<Ticket> {
    const ticket = await Q.ticket.get({ id: ticketId });

    if (ticket.status !== TicketStatus.CLOSED) {
      throw new Error(`Ticket #${ticket.ticketNumber} is not closed`);
    }

    const updatedTicket = await Q.ticket.updateAndReturn(
      {
        id: ticketId,
      },
      {
        status: TicketStatus.OPEN,
        closedAt: null,
        closedByDiscordId: null,
      },
    );

    await this.logAction({
      ticketId,
      actionType: TicketUserAction.REOPENED,
      performedByDiscordId: reopenedBy,
    });

    logger.info(
      `Reopened ticket #${ticket.ticketNumber} (ID: ${ticketId}) by user ${reopenedBy}`,
    );

    return updatedTicket;
  }

  /**
   * Marks a ticket as deleted in the database
   *
   * @param ticketId - Ticket ID to delete
   * @param deletedBy - Discord ID of the user deleting the ticket
   * @returns Promise resolving to the updated ticket
   */
  async delete(ticketId: number, deletedBy: string): Promise<Ticket> {
    const ticket = await Q.ticket.get({ id: ticketId });

    await this.logAction({
      ticketId,
      actionType: TicketUserAction.DELETED,
      performedByDiscordId: deletedBy,
      metadata: {
        deletedAt: new Date().toISOString(),
      },
    });

    const updatedTicket = await Q.ticket.updateAndReturn(
      { id: ticketId },
      {
        status: TicketStatus.DELETED,
        deletedAt: new Date(),
      },
    );

    logger.info(
      `Deleted ticket #${ticket.ticketNumber} (ID: ${ticketId}) by user ${deletedBy}`,
    );

    return updatedTicket;
  }

  /**
   * Updates ticket metadata
   *
   * @param ticketId - Ticket ID
   * @param metadata - Metadata to merge with existing
   * @returns Promise resolving to the updated Ticket
   */
  async updateMetadata(
    ticketId: number,
    metadata: Record<string, any>,
  ): Promise<Ticket> {
    const ticket = await Q.ticket.get({ id: ticketId });

    return await Q.ticket.updateAndReturn(
      { id: ticketId },
      {
        metadata: {
          ...ticket.metadata,
          ...metadata,
        },
      },
    );
  }

  /**
   * Logs an action performed on a ticket
   *
   * @param data - Action data
   * @returns Promise resolving to the created action entry
   */
  async logAction(data: TicketActionCreate): Promise<TicketAction> {
    return await Q.ticket.action.createAndReturn(data);
  }

  /**
   * Gets all actions for a ticket
   *
   * @param ticketId - Ticket ID
   * @returns Promise resolving to an array of ticket actions
   */
  async getTicketActions(ticketId: number): Promise<TicketAction[]> {
    return await Q.ticket.action.findAll(
      { id: ticketId },
      {
        orderBy: DatabaseTable.TICKET_ACTION.CAMEL_FIELDS.PERFORMED_AT,
        orderDirection: "asc",
      },
    );
  }

  /**
   * Gets all open tickets for a user
   *
   * @param discordId - Discord user ID
   * @returns Promise resolving to an array of open tickets
   */
  async getUserOpen(discordId: string): Promise<Ticket[]> {
    return await Q.ticket.findAll({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });
  }

  /**
   * Gets all tickets for a user
   *
   * @param discordId - Discord user ID
   * @param options - Optional query options
   * @returns Promise resolving to an array of tickets
   */
  async getUser(
    discordId: string,
    options?: {
      status?: TicketStatus;
      type?: TicketType;
      limit?: number;
      orderBy?: "createdAt" | "ticketNumber";
      orderDirection?: "asc" | "desc";
    },
  ): Promise<Ticket[]> {
    const filters: any = {
      creatorDiscordId: discordId,
    };

    if (options?.status) {
      filters.status = options.status;
    }

    if (options?.type) {
      filters.type = options.type;
    }

    return await Q.ticket.findAll(filters, {
      limit: options?.limit,
      orderBy: options?.orderBy,
      orderDirection: options?.orderDirection,
    });
  }

  /**
   * Checks if a user has an open ticket
   *
   * @param discordId - Discord user ID
   * @returns Promise resolving to true if user has an open ticket, false otherwise
   */
  async hasOpen(discordId: string): Promise<boolean> {
    const count = await Q.ticket.count({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });

    return count > 0;
  }

  /**
   * Counts open tikets for a user
   *
   * @param discordId - Discord user ID
   * @returns Promise resolving to a number of open tickets
   */
  async countUserOpen(discordId: string): Promise<number> {
    return await Q.ticket.count({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });
  }

  /**
   * Gets all open tickets
   *
   * @returns Promise resolving to an array of open tickets
   */
  async getAllOpen(): Promise<Ticket[]> {
    return await Q.ticket.findAll(
      { status: TicketStatus.OPEN },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Gets all tickets by status
   *
   * @param status - Ticket status
   * @returns Promise resolving to an array of tickets
   */
  async getByStatus(status: TicketStatus): Promise<Ticket[]> {
    return await Q.ticket.findAll(
      { status },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Gets all tickets by type
   *
   * @param type - Ticket type
   * @returns Promise resolving to an array of tickets
   */
  async getByType(type: TicketType): Promise<Ticket[]> {
    return await Q.ticket.findAll(
      { type },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /**
   * Gets statistics about tickets
   *
   * @returns Promise resolving to ticket statistics
   */
  async getStats(): Promise<{
    total: number;
    open: number;
    closed: number;
    deleted: number;
    byType: Record<TicketType, number>;
  }> {
    const total = await Q.ticket.count();
    const open = await Q.ticket.count({ status: TicketStatus.OPEN });
    const closed = await Q.ticket.count({ status: TicketStatus.CLOSED });
    const deleted = await Q.ticket.count({ status: TicketStatus.DELETED });

    const byType: Record<TicketType, number> = {
      [TicketType.GENERAL]: await Q.ticket.count({ type: TicketType.GENERAL }),
      [TicketType.REPORT]: await Q.ticket.count({ type: TicketType.REPORT }),
    };

    return {
      total,
      open,
      closed,
      deleted,
      byType,
    };
  }

  /**
   * Gets recent tickets with pagination
   *
   * @param limit - Number of tickets to return
   * @param offset - Number of tickets to skip
   * @returns Promise resolving to an array of tickets to skip
   */
  async getRecent(limit: number = 10, offset: number = 0): Promise<Ticket[]> {
    return await Q.ticket.getAll({
      limit,
      offset,
      orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
      orderDirection: "desc",
    });
  }
}
