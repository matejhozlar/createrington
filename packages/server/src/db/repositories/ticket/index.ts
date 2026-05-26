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
  TicketFilters,
} from "@/generated/db";
import { DatabaseTable } from "@/generated/db";
import { Q } from "@/db";

interface TicketCloseData {
  closedByDiscordId: string;
  transcriptPath?: string;
}

/**
 * Ticket lifecycle and read access. Owns create/close/reopen/delete
 * transitions, the matching ticket_action audit entries, and the user-facing
 * and admin-facing query surface. Lifecycle methods always pair the
 * status change with a logAction() write so the audit trail stays complete.
 */
export class TicketRepository {
  /** Allocate and return the next monotonic ticket number. */
  async getNext(): Promise<number> {
    return await Q.ticket.getNext();
  }

  /** Create an OPEN ticket and log the CREATED action. */
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

  /** Mark a ticket CLOSED, attach the transcript URL, log the action. Throws if already closed. */
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

  /** Move a CLOSED ticket back to OPEN and clear close fields. Throws if it isn't closed. */
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

  /** Soft-delete a ticket (status DELETED, deletedAt set); the row is retained for audit. */
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

  /** Shallow-merge into the ticket's metadata JSON blob. */
  async updateMetadata(
    ticketId: number,
    metadata: Record<string, unknown>,
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

  /** Append a row to the ticket_action audit table. */
  async logAction(data: TicketActionCreate): Promise<TicketAction> {
    return await Q.ticket.action.createAndReturn(data);
  }

  /** Full audit trail for a ticket, ordered oldest first. */
  async getTicketActions(ticketId: number): Promise<TicketAction[]> {
    return await Q.ticket.action.findAll(
      { id: ticketId },
      {
        orderBy: DatabaseTable.TICKET_ACTION.CAMEL_FIELDS.PERFORMED_AT,
        orderDirection: "asc",
      },
    );
  }

  /** Open tickets created by the user. */
  async getUserOpen(discordId: string): Promise<Ticket[]> {
    return await Q.ticket.findAll({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });
  }

  /** All tickets created by the user, with optional status/type filters and ordering. */
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
    const filters: Partial<TicketFilters> = {
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

  /** True if the user has at least one OPEN ticket. */
  async hasOpen(discordId: string): Promise<boolean> {
    const count = await Q.ticket.count({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });

    return count > 0;
  }

  /** Number of OPEN tickets for the user. */
  async countUserOpen(discordId: string): Promise<number> {
    return await Q.ticket.count({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });
  }

  /** All OPEN tickets across users, newest first. */
  async getAllOpen(): Promise<Ticket[]> {
    return await Q.ticket.findAll(
      { status: TicketStatus.OPEN },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /** All tickets matching a status, newest first. */
  async getByStatus(status: TicketStatus): Promise<Ticket[]> {
    return await Q.ticket.findAll(
      { status },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /** All tickets matching a type, newest first. */
  async getByType(type: TicketType): Promise<Ticket[]> {
    return await Q.ticket.findAll(
      { type },
      {
        orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
        orderDirection: "desc",
      },
    );
  }

  /** Global ticket counts broken down by status and by type. */
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

  /** Paginated list of recent tickets, newest first. */
  async getRecent(limit: number = 10, offset: number = 0): Promise<Ticket[]> {
    return await Q.ticket.getAll({
      limit,
      offset,
      orderBy: DatabaseTable.TICKET.CAMEL_FIELDS.CREATED_AT,
      orderDirection: "desc",
    });
  }
}
