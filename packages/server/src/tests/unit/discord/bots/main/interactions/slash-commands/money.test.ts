import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const { findPlayer, findBalance } = vi.hoisted(() => ({
  findPlayer: vi.fn(),
  findBalance: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: { player: { find: findPlayer, balance: { find: findBalance } } },
}));
vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    error: (title: string, description?: string) => ({
      build: () => ({ kind: "error", title, description }),
    }),
    plain: (options: { title: string; description: string }) => ({
      build: () => ({ kind: "plain", ...options }),
    }),
  },
}));

import { execute } from "@/discord/bots/main/interactions/slash-commands/user/money";

function moneyInteraction() {
  const fake = {
    user: { id: "100000000000000001" },
    deferred: false,
    replied: false,
    reply: vi.fn(async () => {}),
  };
  return { fake, interaction: fake as unknown as ChatInputCommandInteraction };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/money", () => {
  it("tells an unregistered user how to register", async () => {
    findPlayer.mockResolvedValue(null);
    const { fake, interaction } = moneyInteraction();

    await execute(interaction);

    expect(findBalance).not.toHaveBeenCalled();
    expect(fake.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({ kind: "error", title: "Not Registered" }),
        ],
      }),
    );
  });

  it("shows the balance of a registered player", async () => {
    findPlayer.mockResolvedValue({ minecraftUuid: "uuid-1" });
    findBalance.mockResolvedValue({ balance: 250n });
    const { fake, interaction } = moneyInteraction();

    await execute(interaction);

    expect(fake.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({ kind: "plain", title: "💰 Your Balance" }),
        ],
      }),
    );
  });
});
