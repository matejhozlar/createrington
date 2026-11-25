import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const { findPlayer } = vi.hoisted(() => ({ findPlayer: vi.fn() }));

vi.mock("@/db", () => ({ Q: { player: { find: findPlayer } } }));
vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    error: (title: string, description?: string) => ({
      build: () => ({ kind: "error", title, description }),
    }),
    plain: (options: { description: string }) => ({
      build: () => ({ kind: "plain", ...options }),
    }),
  },
}));

import handler from "@/discord/bots/main/interactions/slash-commands/admin/username";

const { execute } = handler;

function usernameInteraction() {
  const fake = {
    options: {
      getUser: () => ({ id: "100000000000000002", displayName: "Target" }),
    },
    deferred: false,
    replied: false,
    reply: vi.fn(async () => {}),
  };
  return { fake, interaction: fake as unknown as ChatInputCommandInteraction };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/username", () => {
  it("answers that an unregistered user is not registered", async () => {
    findPlayer.mockResolvedValue(null);
    const { fake, interaction } = usernameInteraction();

    await execute(interaction);

    expect(fake.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            kind: "error",
            title: "Not Registered",
            description: "Target is not registered.",
          }),
        ],
      }),
    );
  });

  it("shows the Minecraft username of a registered user", async () => {
    findPlayer.mockResolvedValue({ minecraftUsername: "Steve" });
    const { fake, interaction } = usernameInteraction();

    await execute(interaction);

    expect(fake.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [{ kind: "plain", description: "Steve" }],
      }),
    );
  });
});
