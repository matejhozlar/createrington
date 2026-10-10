import { beforeEach, describe, expect, it, vi } from "vitest";

const ticketFind = vi.hoisted(() => vi.fn());
const removeParticipant = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({ Q: { ticket: { find: ticketFind } } }));

vi.mock("@/discord/embeds", () => {
  const preset = (kind: string) => (title: string, description?: string) => ({
    build: () => ({ kind, title, description }),
  });
  return {
    EmbedPresets: {
      success: preset("success"),
      info: preset("info"),
      error: preset("error"),
    },
  };
});

vi.mock("@/discord/utils/cooldown", () => ({ CooldownType: { USER: "user" } }));

vi.mock("@/discord/constants", () => ({
  Discord: { Users: { mention: (id: string) => `<@${id}>` } },
}));

vi.mock("@/services/discord/tickets", () => ({
  TicketType: { GENERAL: "general" },
}));

vi.mock("@/services", () => ({
  Services: { TICKET_SERVICE: "ticket-service" },
  getService: async () => ({ removeParticipant }),
}));

import {
  data,
  execute,
} from "@/discord/bots/main/interactions/slash-commands/admin/ticket";
import type { ChatInputCommandInteraction } from "discord.js";

interface SentEmbed {
  kind: string;
  title: string;
  description?: string;
}

function removeInteraction(userId: string) {
  const sent: SentEmbed[] = [];
  const record = async (message: { embeds: SentEmbed[] }) => {
    sent.push(...message.embeds);
  };
  const fake = {
    options: {
      getSubcommand: () => "remove",
      getUser: () => ({ id: userId }),
    },
    channel: {},
    channelId: "channel-1",
    user: { id: "admin-1" },
    deferred: false,
    replied: false,
    reply: vi.fn(record),
    editReply: vi.fn(record),
    followUp: vi.fn(record),
    deferReply: vi.fn(async () => {
      fake.deferred = true;
    }),
  };
  return { fake: fake as unknown as ChatInputCommandInteraction, sent };
}

describe("/ticket remove", () => {
  beforeEach(() => {
    ticketFind.mockReset();
    ticketFind.mockResolvedValue({ id: 7, creatorDiscordId: "owner-1" });
    removeParticipant.mockReset();
    removeParticipant.mockResolvedValue({ removed: true });
  });

  it("requires the user to remove", () => {
    const remove = data.toJSON().options?.find((opt) => opt.name === "remove");

    expect(remove).toMatchObject({
      options: [{ name: "user", required: true }],
    });
  });

  it("revokes the user's access to the ticket of the current channel", async () => {
    const { fake, sent } = removeInteraction("guest-1");

    await execute(fake);

    expect(ticketFind).toHaveBeenCalledWith({ channelId: "channel-1" });
    expect(removeParticipant).toHaveBeenCalledWith("channel-1", "guest-1");
    expect(sent).toEqual([
      {
        kind: "success",
        title: "Removed from Ticket",
        description: "<@guest-1> no longer has access to this ticket.",
      },
    ]);
  });

  it("refuses to remove the user who owns the ticket", async () => {
    const { fake, sent } = removeInteraction("owner-1");

    await execute(fake);

    expect(removeParticipant).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "error", title: "Ticket Owner" });
  });

  it("refuses outside a ticket channel", async () => {
    ticketFind.mockResolvedValue(null);
    const { fake, sent } = removeInteraction("guest-1");

    await execute(fake);

    expect(removeParticipant).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "error", title: "Not a Ticket" });
  });

  it("says so when the user was never added to the ticket", async () => {
    removeParticipant.mockResolvedValue({
      removed: false,
      reason: "not-participant",
    });
    const { fake, sent } = removeInteraction("guest-1");

    await execute(fake);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "info", title: "Nothing Removed" });
  });

  it("reports an error when the channel permissions cannot be changed", async () => {
    removeParticipant.mockResolvedValue({
      removed: false,
      reason: "channel-error",
    });
    const { fake, sent } = removeInteraction("guest-1");

    await execute(fake);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "error", title: "Ticket Error" });
  });
});
