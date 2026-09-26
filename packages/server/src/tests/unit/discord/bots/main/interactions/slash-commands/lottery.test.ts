import { describe, it, expect, vi, beforeEach } from "vitest";

const replyError = vi.hoisted(() => vi.fn(async () => {}));
const lottery = vi.hoisted(() => ({
  active: false,
  start: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

vi.mock("@/config", () => ({
  default: { economy: { lottery: { minAmount: 10 } } },
}));

vi.mock("@/db", () => ({
  player: {
    find: async () => ({ minecraftUuid: "uuid", minecraftUsername: "Steve" }),
  },
}));

vi.mock("@/discord/embeds", () => ({ EmbedPresets: {} }));
vi.mock("@/discord/utils/interaction-reply", () => ({ replyError }));
vi.mock("@/discord/utils/cooldown", () => ({ CooldownType: { USER: "user" } }));

vi.mock("@/services/lottery", async () => {
  const errors = await vi.importActual<
    typeof import("@/services/lottery/errors")
  >("@/services/lottery/errors");
  return {
    ...errors,
    lotteryService: {
      isActive: () => lottery.active,
      start: lottery.start,
      join: vi.fn(),
    },
  };
});

import { execute } from "@/discord/bots/main/interactions/slash-commands/user/lottery";
import { LotteryCooldownError } from "@/services/lottery/errors";
import { discordTimestamp } from "@/utils/format";
import type { ChatInputCommandInteraction } from "discord.js";

function interactionWith(amount: number) {
  const reply = vi.fn(async () => {});
  const fake = {
    options: { getNumber: () => amount },
    user: { id: "123", tag: "steve#0001" },
    reply,
  };
  return { fake: fake as unknown as ChatInputCommandInteraction, reply };
}

describe("/lottery on start cooldown", () => {
  beforeEach(() => {
    replyError.mockClear();
    lottery.active = false;
    lottery.start.mockReset();
  });

  it("answers with a relative timestamp instead of the generic error", async () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const nextStartAt = new Date(now.getTime() + 40 * 60 * 1000);
    lottery.start.mockRejectedValue(new LotteryCooldownError(nextStartAt, now));
    const { fake, reply } = interactionWith(50);

    await execute(fake);

    expect(replyError).toHaveBeenCalledWith(
      fake,
      "Lottery Cooldown",
      `The next lottery can start ${discordTimestamp(nextStartAt, "R")}.`,
    );
    expect(reply).not.toHaveBeenCalled();
  });

  it("keeps the generic error path for other failures", async () => {
    lottery.start.mockRejectedValue(new Error("db down"));
    const { fake } = interactionWith(50);

    await execute(fake);

    expect(replyError).toHaveBeenCalledWith(fake, "Lottery Error", "db down");
  });
});
