import { describe, it, expect, afterEach, afterAll } from "vitest";
import { db, Q, ticketRepo } from "@/db";
import { UniqueViolationError } from "@/db/utils/errors";
import { TicketType } from "@/services/discord/tickets";
import { cleanupTestPool } from "@/tests/helpers/db";

const CREATOR = "900000000000000777";
const CHANNEL_PREFIX = "ticket-repo-test-";

async function createTicket(ticketNumber: number, suffix: string) {
  return ticketRepo.create({
    ticketNumber,
    type: TicketType.GENERAL,
    creatorDiscordId: CREATOR,
    channelId: `${CHANNEL_PREFIX}${suffix}`,
  });
}

afterEach(async () => {
  await Q.ticket.deleteAll({ channelId: { $like: `${CHANNEL_PREFIX}%` } });
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("TicketRepository ticket numbers", () => {
  it("allocates a fresh number on every call", async () => {
    const first = await Q.ticket.allocateNumber();
    const second = await Q.ticket.allocateNumber();

    expect(second).toBeGreaterThan(first);
  });

  it("stores the allocated number and records it on the CREATED action", async () => {
    const ticketNumber = await Q.ticket.allocateNumber();

    const ticket = await createTicket(ticketNumber, "a");

    expect(ticket.ticketNumber).toBe(ticketNumber);
    const [action] = await Q.ticket.action.findAll({ ticketId: ticket.id });
    expect(action.actionType).toBe("created");
    expect(action.metadata).toMatchObject({ ticketNumber });
  });

  it("rejects a second ticket with the same number", async () => {
    const ticketNumber = await Q.ticket.allocateNumber();
    await createTicket(ticketNumber, "a");

    const error = await createTicket(ticketNumber, "b").catch((e) => e);

    expect(error).toBeInstanceOf(UniqueViolationError);
    expect(await Q.ticket.find({ channelId: `${CHANNEL_PREFIX}b` })).toBeNull();
  });
});

describe("TicketRepository lifecycle", () => {
  const STAFF = "900000000000000778";

  async function actionTypes(ticketId: number) {
    const actions = await Q.ticket.action.findAll(
      { ticketId },
      { orderBy: "id" },
    );
    return actions.map((action) => action.actionType);
  }

  it("records an audit action for every close, reopen and delete", async () => {
    const ticket = await createTicket(await Q.ticket.allocateNumber(), "a");

    const closed = await ticketRepo.close(ticket.id, STAFF);
    expect(closed).toMatchObject({
      status: "closed",
      closedByDiscordId: STAFF,
    });

    const reopened = await ticketRepo.reopen(ticket.id, STAFF);
    expect(reopened).toMatchObject({ status: "open", closedByDiscordId: null });

    const deleted = await ticketRepo.delete(ticket.id, STAFF);
    expect(deleted.status).toBe("deleted");

    expect(await actionTypes(ticket.id)).toEqual([
      "created",
      "closed",
      "reopened",
      "deleted",
    ]);
  });

  it("drops the stored transcript on reopen and keeps the rest of the metadata", async () => {
    const ticket = await createTicket(await Q.ticket.allocateNumber(), "a");
    await ticketRepo.updateMetadata(ticket.id, {
      closeMessageId: "555",
      transcriptPath: "storage/transcripts/ticket-1-1.html",
    });
    await ticketRepo.close(ticket.id, STAFF);

    const reopened = await ticketRepo.reopen(ticket.id, STAFF);

    expect(reopened.metadata).toEqual({ closeMessageId: "555" });
  });

  it("makes a close wait for a concurrent transition and then see its result", async () => {
    const ticket = await createTicket(await Q.ticket.allocateNumber(), "a");
    let closing: Promise<unknown> = Promise.resolve();

    await db.inTransaction(async (tx) => {
      await tx.ticket.getForUpdate(ticket.id);
      closing = ticketRepo.close(ticket.id, STAFF).catch((e: unknown) => e);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await tx.ticket.update({ id: ticket.id }, { status: "closed" });
    });

    const error = await closing;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/already closed/);
    expect(await actionTypes(ticket.id)).toEqual(["created"]);
  });

  it("leaves the ticket open when the CLOSED audit row cannot be written", async () => {
    const ticket = await createTicket(await Q.ticket.allocateNumber(), "a");

    const error = await ticketRepo
      .close(ticket.id, null as unknown as string)
      .catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect((await Q.ticket.get({ id: ticket.id })).status).toBe("open");
    expect(await actionTypes(ticket.id)).toEqual(["created"]);
  });
});
