import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const { findPlayer, checkEligibility, claim } = vi.hoisted(() => ({
  findPlayer: vi.fn(),
  checkEligibility: vi.fn(),
  claim: vi.fn(),
}));

vi.mock("@/db", () => ({ Q: { player: { find: findPlayer } } }));
vi.mock("@/discord/embeds", () => {
  const preset = (kind: string) => (title: string, description?: string) => {
    const embed = {
      field: () => embed,
      timestamp: () => embed,
      build: () => ({ kind, title, description }),
    };
    return embed;
  };
  return {
    EmbedPresets: { error: preset("error"), success: preset("success") },
  };
});
vi.mock("@/discord/utils/cooldown", () => ({ CooldownType: { USER: "user" } }));
vi.mock("@/services/reward/daily-reward.service", () => ({
  dailyRewardService: { checkEligibility, claim },
}));

import handler from "@/discord/bots/main/interactions/slash-commands/user/daily";

const { execute } = handler;

function dailyInteraction() {
  const fake = {
    user: { id: "100000000000000001", displayName: "Someone", tag: "someone" },
    deferred: false,
    replied: false,
    reply: vi.fn(async () => {}),
  };
  return { fake, interaction: fake as unknown as ChatInputCommandInteraction };
}

function repliedWith(fake: { reply: ReturnType<typeof vi.fn> }, title: string) {
  expect(fake.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      embeds: [expect.objectContaining({ title })],
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  findPlayer.mockResolvedValue({ minecraftUuid: "uuid-1" });
});

describe("/daily", () => {
  it("tells an unregistered user they are not registered", async () => {
    findPlayer.mockResolvedValue(null);
    const { fake, interaction } = dailyInteraction();

    await execute(interaction);

    repliedWith(fake, "Not Registered");
    expect(checkEligibility).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
  });

  it("reports a failed eligibility check as unavailable", async () => {
    checkEligibility.mockResolvedValue({
      eligible: false,
      reason: "Failed to check eligibility",
    });
    const { fake, interaction } = dailyInteraction();

    await execute(interaction);

    repliedWith(fake, "Daily Reward Unavailable");
    expect(claim).not.toHaveBeenCalled();
  });

  it("tells a player who claimed this period that it is already claimed", async () => {
    checkEligibility.mockResolvedValue({
      eligible: false,
      reason: "Already claimed for this period",
      nextClaimTime: new Date("2026-11-26T00:00:00Z"),
    });
    const { fake, interaction } = dailyInteraction();

    await execute(interaction);

    repliedWith(fake, "Already Claimed");
    expect(claim).not.toHaveBeenCalled();
  });

  it("claims for the registered player", async () => {
    checkEligibility.mockResolvedValue({ eligible: true });
    claim.mockResolvedValue({ success: true, amount: 20, newBalance: 120 });
    const { fake, interaction } = dailyInteraction();

    await execute(interaction);

    expect(claim).toHaveBeenCalledWith({ minecraftUuid: "uuid-1" });
    repliedWith(fake, "💰 Daily Reward Claimed!");
  });
});
