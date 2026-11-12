import { describe, it, expect, afterEach, afterAll } from "vitest";
import { Q } from "@/db";
import { TicketRepository } from "@/db/repositories/ticket";
import { UniqueViolationError } from "@/db/utils/errors";
import { TicketType, TicketUserAction } from "@/services/discord/tickets";
import { cleanupTestPool } from "@/tests/helpers/db";

const CREATOR = "900000000000000777";
const CHANNEL_PREFIX = "ticket-repo-test-";

const repository = new TicketRepository();

async function createTicket(ticketNumber: number, suffix: string) {
  return repository.create({
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
    const first = await repository.allocateNumber();
    const second = await repository.allocateNumber();

    expect(second).toBeGreaterThan(first);
  });

  it("stores the allocated number and records it on the CREATED action", async () => {
    const ticketNumber = await repository.allocateNumber();

    const ticket = await createTicket(ticketNumber, "a");

    expect(ticket.ticketNumber).toBe(ticketNumber);
    const [action] = await Q.ticket.action.findAll({ ticketId: ticket.id });
    expect(action.actionType).toBe(TicketUserAction.CREATED);
    expect(action.metadata).toMatchObject({ ticketNumber });
  });

  it("rejects a second ticket with the same number", async () => {
    const ticketNumber = await repository.allocateNumber();
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
    const ticket = await createTicket(await repository.allocateNumber(), "a");

    const closed = await repository.close(ticket.id, STAFF);
    expect(closed).toMatchObject({
      status: "closed",
      closedByDiscordId: STAFF,
    });

    const reopened = await repository.reopen(ticket.id, STAFF);
    expect(reopened).toMatchObject({ status: "open", closedByDiscordId: null });

    const deleted = await repository.delete(ticket.id, STAFF);
    expect(deleted.status).toBe("deleted");

    expect(await actionTypes(ticket.id)).toEqual([
      TicketUserAction.CREATED,
      TicketUserAction.CLOSED,
      TicketUserAction.REOPENED,
      TicketUserAction.DELETED,
    ]);
  });

  it("leaves the ticket open when the CLOSED audit row cannot be written", async () => {
    const ticket = await createTicket(await repository.allocateNumber(), "a");

    const error = await repository
      .close(ticket.id, null as unknown as string)
      .catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect((await Q.ticket.get({ id: ticket.id })).status).toBe("open");
    expect(await actionTypes(ticket.id)).toEqual([TicketUserAction.CREATED]);
  });
});
