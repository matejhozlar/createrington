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
