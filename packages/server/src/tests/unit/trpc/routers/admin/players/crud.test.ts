import { describe, it, expect, vi, beforeEach } from "vitest";

const { OWNER_DISCORD_ID } = vi.hoisted(() => ({
  OWNER_DISCORD_ID: "100000000000000777",
}));

const { Q, playerRepo, deletePlayer } = vi.hoisted(() => ({
  Q: {
    player: { find: vi.fn() },
    admin: { exists: vi.fn() },
  },
  playerRepo: { adminUpdate: vi.fn() },
  deletePlayer: vi.fn(),
}));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    default: {
      ...actual.default,
      app: {
        ...actual.default.app,
        auth: {
          ...actual.default.app.auth,
          owner: { discordId: OWNER_DISCORD_ID },
        },
      },
    },
  };
});
vi.mock("@/db", () => ({
  Q,
  playerRepo,
  playerBanRepo: {},
  playerStrikeRepo: {},
}));
vi.mock("@/services/player/deletion", () => ({
  playerDeletionService: { delete: deletePlayer },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn().mockResolvedValue(true) },
}));

import { TRPCError } from "@trpc/server";
import { playersRouter } from "@/trpc/routers/admin/players/crud";
import { adminContext } from "@/tests/helpers/trpc";

const TARGET = {
  discordId: "100000000000000001",
  minecraftUsername: "Steve",
  minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const adminCaller = playersRouter.createCaller(adminContext());
const ownerCaller = playersRouter.createCaller(
  adminContext({ discordId: OWNER_DISCORD_ID }),
);

async function rejection(call: Promise<unknown>): Promise<TRPCError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected the call to be rejected");
}

function givenTarget(options: { admin?: boolean; owner?: boolean } = {}) {
  Q.player.find.mockResolvedValue({
    ...TARGET,
    discordId: options.owner ? OWNER_DISCORD_ID : TARGET.discordId,
  });
  Q.admin.exists.mockResolvedValue(options.admin ?? false);
}

beforeEach(() => {
  vi.clearAllMocks();
  playerRepo.adminUpdate.mockResolvedValue(TARGET);
  deletePlayer.mockResolvedValue(TARGET);
  givenTarget();
});

describe("admin.players.players.update", () => {
  const relink = {
    id: TARGET.minecraftUuid,
    discordId: "100000000000000002",
    reason: "lost account",
  };

  it("refuses to move an admin's player to another Discord account", async () => {
    givenTarget({ admin: true });

    const error = await rejection(adminCaller.update(relink));

    expect(error.code).toBe("FORBIDDEN");
    expect(playerRepo.adminUpdate).not.toHaveBeenCalled();
  });

  it("refuses to move the owner's player to another Discord account", async () => {
    givenTarget({ owner: true });

    const error = await rejection(adminCaller.update(relink));

    expect(error.code).toBe("FORBIDDEN");
  });

  it("lets the owner move an admin's player", async () => {
    givenTarget({ admin: true });

    await ownerCaller.update(relink);

    expect(playerRepo.adminUpdate).toHaveBeenCalledOnce();
  });

  it("lets an admin rename another admin's player", async () => {
    givenTarget({ admin: true });

    await adminCaller.update({
      id: TARGET.minecraftUuid,
      minecraftUsername: "Alex",
      reason: "name change",
    });

    expect(playerRepo.adminUpdate).toHaveBeenCalledOnce();
  });

  it("lets an admin move a regular player", async () => {
    await adminCaller.update(relink);

    expect(playerRepo.adminUpdate).toHaveBeenCalledOnce();
  });
});

describe("admin.players.players.delete", () => {
  const input = { id: TARGET.minecraftUuid, reason: "cleanup" };

  it("refuses to delete an admin", async () => {
    givenTarget({ admin: true });

    const error = await rejection(adminCaller.delete(input));

    expect(error.code).toBe("FORBIDDEN");
    expect(deletePlayer).not.toHaveBeenCalled();
  });

  it("lets the owner delete an admin", async () => {
    givenTarget({ admin: true });

    await ownerCaller.delete(input);

    expect(deletePlayer).toHaveBeenCalledOnce();
  });

  it("lets an admin delete a regular player", async () => {
    await adminCaller.delete(input);

    expect(deletePlayer).toHaveBeenCalledOnce();
  });
});
