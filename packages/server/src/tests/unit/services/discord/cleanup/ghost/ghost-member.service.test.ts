import { describe, it, expect, beforeEach, vi } from "vitest";

const { lookupMember, deletePlayer, players } = vi.hoisted(() => ({
  lookupMember: vi.fn(),
  deletePlayer: vi.fn(),
  players: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/services/waitlist/discord-lookup", () => ({ lookupMember }));

vi.mock("@/db", () => ({
  Q: {
    player: { findAll: async () => players },
    admin: { findAll: async () => [] },
  },
}));

vi.mock("@/discord/utils/guild-members", () => ({
  loadAllGuildMembers: async () => {},
}));

vi.mock("@/services", () => ({
  Services: { DISCORD_MAIN_BOT: "DISCORD_MAIN_BOT" },
  getServiceSync: () => ({
    guilds: {
      cache: { first: () => ({ members: { cache: new Map() } }) },
    },
  }),
}));

vi.mock("@/services/player/deletion", () => ({
  playerDeletionService: { delete: deletePlayer },
}));

import { GhostMemberService } from "@/services/discord/cleanup/ghost/ghost-member.service";
import { ConflictError, ServiceUnavailableError } from "@/errors";

const ACTOR = { type: "admin", discordId: "1", username: "admin" } as const;

async function serviceWithGhost(): Promise<GhostMemberService> {
  const service = new GhostMemberService();
  await service.refresh();
  return service;
}

beforeEach(() => {
  lookupMember.mockReset();
  deletePlayer.mockReset();
  players.length = 0;
  players.push({
    discordId: "500",
    minecraftUuid: "11111111-1111-1111-1111-111111111111",
    minecraftUsername: "ghosty",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastSeen: new Date("2026-02-01T00:00:00Z"),
  });
});

describe("GhostMemberService.remove", () => {
  it("deletes the player when Discord confirms the member is gone", async () => {
    lookupMember.mockResolvedValue({ state: "gone" });
    const service = await serviceWithGhost();

    await service.remove("500", ACTOR);

    expect(lookupMember).toHaveBeenCalledWith("500", { force: true });
    expect(deletePlayer).toHaveBeenCalledTimes(1);
  });

  it("keeps the player when the member lookup fails", async () => {
    lookupMember.mockResolvedValue({ state: "unavailable" });
    const service = await serviceWithGhost();

    await expect(service.remove("500", ACTOR)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(service.list({ page: 0, limit: 10 }).total).toBe(1);
  });

  it("keeps the player and evicts the ghost when the member has rejoined", async () => {
    lookupMember.mockResolvedValue({ state: "found", member: { id: "500" } });
    const service = await serviceWithGhost();

    await expect(service.remove("500", ACTOR)).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(service.list({ page: 0, limit: 10 }).total).toBe(0);
  });
});
