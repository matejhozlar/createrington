import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const { findMessage, refresh } = vi.hoisted(() => ({
  findMessage: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: { leaderboard: { message: { find: findMessage } } },
}));
vi.mock("@/discord/embeds", () => {
  const preset = (kind: string) => (title: string, description?: string) => ({
    build: () => ({ kind, title, description }),
  });
  return {
    EmbedPresets: { success: preset("success"), error: preset("error") },
  };
});
vi.mock("@/services", () => ({
  Services: { LEADERBOARD_SERVICE: "LEADERBOARD_SERVICE" },
  getService: async () => ({ refresh }),
}));
vi.mock("@/services/discord/leaderboard", () => ({
  getAllLeaderboardTypes: () => ["playtime"],
}));

import handler from "@/discord/bots/main/interactions/slash-commands/admin/leaderboard";
import { InteractionError } from "@/discord/utils/interaction-error";

const { execute } = handler;

function refreshInteraction() {
  const fake = {
    options: {
      getSubcommand: () => "refresh",
      getString: () => "playtime",
    },
    deferred: false,
    replied: false,
    deferReply: vi.fn(async () => {
      fake.deferred = true;
    }),
    editReply: vi.fn(async () => {}),
  };
  return { fake, interaction: fake as unknown as ChatInputCommandInteraction };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/leaderboard refresh", () => {
  it("points to /leaderboard create when no leaderboard was posted", async () => {
    findMessage.mockResolvedValue(null);
    const { fake, interaction } = refreshInteraction();

    await execute(interaction);

    expect(refresh).not.toHaveBeenCalled();
    expect(fake.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          kind: "error",
          title: "No Leaderboard",
          description:
            "There is no playtime leaderboard yet. Run `/leaderboard create` to post one.",
        },
      ],
    });
  });

  it("fails with a refresh error carrying the service reason when the refresh fails", async () => {
    findMessage.mockResolvedValue({ id: 1, leaderboardType: "playtime" });
    refresh.mockResolvedValue({
      success: false,
      type: "playtime",
      entries: [],
      error: "Missing Access",
    });
    const { interaction } = refreshInteraction();

    const failure = await execute(interaction).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(InteractionError);
    expect(failure).toMatchObject({
      title: "Refresh Failed",
      cause: expect.objectContaining({ message: "Missing Access" }),
    });
  });
});
