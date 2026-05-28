import { TicketStatus, TicketUserAction } from "@/services/discord/tickets";
import type {
  Ticket,
  TicketAction,
  TicketActionCreate,
  TicketCreate,
} from "@/generated/db";
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

  /** True if the user has at least one OPEN ticket. */
  async hasOpen(discordId: string): Promise<boolean> {
    const count = await Q.ticket.count({
      creatorDiscordId: discordId,
      status: TicketStatus.OPEN,
    });

    return count > 0;
  }
}
