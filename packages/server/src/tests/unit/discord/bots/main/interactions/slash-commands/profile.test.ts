import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const { getDetailed } = vi.hoisted(() => ({ getDetailed: vi.fn() }));

vi.mock("@/db", () => ({ playerRepo: { getDetailed } }));
vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    error: (title: string, description?: string) => ({
      build: () => ({ kind: "error", title, description }),
    }),
  },
}));
vi.mock("@/discord/utils/render-screenshot", () => ({
  renderScreenshot: vi.fn(),
}));

import { execute } from "@/discord/bots/main/interactions/slash-commands/user/profile";
import { NotFoundError } from "@/db/utils/errors";

function interaction() {
  const fake = {
    options: { getUser: () => null },
    user: { id: "100000000000000001", displayName: "steve_*" },
    deferred: false,
    replied: false,
    deferReply: vi.fn(async () => {
      fake.deferred = true;
    }),
    editReply: vi.fn(async () => {}),
    reply: vi.fn(async () => {}),
    followUp: vi.fn(async () => {}),
  };
  return { fake, interaction: fake as unknown as ChatInputCommandInteraction };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/profile player lookup", () => {
  it("says the player is not registered when no player row exists", async () => {
    getDetailed.mockRejectedValue(
      new NotFoundError("player", { discordId: "100000000000000001" }),
    );
    const { fake, interaction: command } = interaction();

    await execute(command);

    expect(fake.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          kind: "error",
          title: "Not Registered",
          description: "steve\\_\\* is not registered.",
        },
      ],
    });
  });

  it("lets a failed lookup reach the dispatcher instead of blaming registration", async () => {
    const outage = new Error("connection terminated");
    getDetailed.mockRejectedValue(outage);
    const { fake, interaction: command } = interaction();

    await expect(execute(command)).rejects.toBe(outage);
    expect(fake.editReply).not.toHaveBeenCalled();
  });
});
