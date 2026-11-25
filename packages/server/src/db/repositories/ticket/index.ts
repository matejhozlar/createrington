import type { TicketMetadata } from "@/services/discord/tickets/types";
import type { Ticket, TicketCreate } from "@/generated/db";
import { db, Q } from "@/db/pool";

/**
 * Ticket lifecycle. Owns create/close/reopen/delete transitions, the
 * matching ticket_action audit entries, metadata merges, and the open-ticket
 * check. Each lifecycle transition writes its status
 * change and its audit row in one transaction, and close/reopen read the
 * ticket under a row lock so concurrent transitions cannot both pass the
 * status check.
 */
export class TicketRepository {
  /** Create an OPEN ticket and log the CREATED action in one transaction. */
  async create(data: TicketCreate): Promise<Ticket> {
    const ticket = await db.inTransaction(async (tx) => {
      const created = await tx.ticket.createAndReturn({
        ticketNumber: data.ticketNumber,
        type: data.type,
        creatorDiscordId: data.creatorDiscordId,
        channelId: data.channelId,
        status: "open",
        metadata: data.metadata || {},
      });

      await tx.ticket.action.create({
        ticketId: created.id,
        actionType: "created",
        performedByDiscordId: data.creatorDiscordId,
        metadata: {
          ticketNumber: created.ticketNumber,
          type: data.type,
          channelId: data.channelId,
        },
      });

      return created;
    });

    logger.info(
      `Created ticket #${ticket.ticketNumber} (ID: ${ticket.id}) for user ${data.creatorDiscordId}`,
    );

    return ticket;
  }

  /** Mark a ticket CLOSED and log the action in one transaction. Throws if already closed. */
  async close(ticketId: number, closedBy: string): Promise<Ticket> {
    const ticket = await db.inTransaction(async (tx) => {
      const current = await tx.ticket.getForUpdate(ticketId);

      if (current.status === "closed") {
        throw new Error(`Ticket #${current.ticketNumber} is already closed`);
      }

      const updated = await tx.ticket.updateAndReturn(
        { id: ticketId },
        {
          status: "closed",
          closedAt: new Date(),
          closedByDiscordId: closedBy,
        },
      );

      await tx.ticket.action.create({
        ticketId,
        actionType: "closed",
        performedByDiscordId: closedBy,
      });

      return updated;
    });

    logger.info(
      `Closed ticket #${ticket.ticketNumber} (ID: ${ticketId}) by user ${closedBy}`,
    );

    return ticket;
  }

  /** Move a CLOSED ticket back to OPEN and log the action in one transaction; drops the stored transcript, which no longer covers the whole conversation. Throws if it isn't closed. */
  async reopen(ticketId: number, reopenedBy: string): Promise<Ticket> {
    const ticket = await db.inTransaction(async (tx) => {
      const current = await tx.ticket.getForUpdate(ticketId);

      if (current.status !== "closed") {
        throw new Error(`Ticket #${current.ticketNumber} is not closed`);
      }

      const metadata = { ...current.metadata };
      delete metadata.transcriptPath;

      const updated = await tx.ticket.updateAndReturn(
        { id: ticketId },
        {
          status: "open",
          closedAt: null,
          closedByDiscordId: null,
          metadata,
        },
      );

      await tx.ticket.action.create({
        ticketId,
        actionType: "reopened",
        performedByDiscordId: reopenedBy,
      });

      return updated;
    });

    logger.info(
      `Reopened ticket #${ticket.ticketNumber} (ID: ${ticketId}) by user ${reopenedBy}`,
    );

    return ticket;
  }

  /** Soft-delete a ticket (status DELETED, deletedAt set) and log the action in one transaction; the row is retained for audit. */
  async delete(ticketId: number, deletedBy: string): Promise<Ticket> {
    const deletedAt = new Date();

    const ticket = await db.inTransaction(async (tx) => {
      const updated = await tx.ticket.updateAndReturn(
        { id: ticketId },
        {
          status: "deleted",
          deletedAt,
        },
      );

      await tx.ticket.action.create({
        ticketId,
        actionType: "deleted",
        performedByDiscordId: deletedBy,
        metadata: {
          deletedAt: deletedAt.toISOString(),
        },
      });

      return updated;
    });

    logger.info(
      `Deleted ticket #${ticket.ticketNumber} (ID: ${ticketId}) by user ${deletedBy}`,
    );

    return ticket;
  }

  /** Shallow-merge into the ticket's metadata JSON blob. */
  async updateMetadata(
    ticketId: number,
    metadata: TicketMetadata,
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

  /** True if the user has at least one OPEN ticket. */
  async hasOpen(discordId: string): Promise<boolean> {
    const count = await Q.ticket.count({
      creatorDiscordId: discordId,
      status: "open",
    });

    return count > 0;
  }
}
