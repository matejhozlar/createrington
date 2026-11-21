import { describe, it, expect, vi } from "vitest";
import { MessageFlags, type ButtonInteraction } from "discord.js";

const findTicket = vi.fn();

vi.mock("@/db", () => ({ Q: { ticket: { find: findTicket } } }));
vi.mock("@/discord/embeds", () => ({ EmbedColors: {}, EmbedPresets: {} }));
vi.mock("@/discord/utils/admin-guard", () => ({ isAdmin: vi.fn() }));
vi.mock("@/discord/utils/interaction-reply", () => ({ replyError: vi.fn() }));
vi.mock("@/services", () => ({ Services: {}, getService: vi.fn() }));
vi.mock("@/services/discord/tickets", () => ({
  isTicketType: (value: string) => value === "general",
  TicketSystemIds: {},
}));

const handler = (
  await import("@/discord/bots/main/interactions/buttons/ticket")
).default;

function click(customId: string) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const interaction = { customId, reply } as unknown as ButtonInteraction;
  return { interaction, reply };
}

describe("ticket button", () => {
  it.each(["ticket:constructor:5", "ticket:toString:5", "ticket:bogus:5"])(
    "answers %s with Unknown action",
    async (customId) => {
      const { interaction, reply } = click(customId);

      await handler.execute(interaction);

      expect(reply).toHaveBeenCalledWith({
        content: "Unknown action",
        flags: MessageFlags.Ephemeral,
      });
      expect(findTicket).not.toHaveBeenCalled();
    },
  );

  it("answers a known action with a non-numeric ticket id with Unknown action", async () => {
    const { interaction, reply } = click("ticket:close:abc");

    await handler.execute(interaction);

    expect(reply).toHaveBeenCalledWith({
      content: "Unknown action",
      flags: MessageFlags.Ephemeral,
    });
  });
});
