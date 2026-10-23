import { describe, it, expect, vi, beforeEach } from "vitest";

type BeforeCommit = (() => Promise<void>) | undefined;

const { Q, bans, rcon, revokeAllForUser, revokeAllForPlayer, deletePlayer } =
  vi.hoisted(() => ({
    Q: {
      player: {
        get: vi.fn(),
        find: vi.fn(),
        ban: { get: vi.fn() },
      },
    },
    bans: { issueTemporary: vi.fn(), createPermanent: vi.fn(), unban: vi.fn() },
    rcon: { banAll: vi.fn(), pardonAll: vi.fn(), whitelistAll: vi.fn() },
    revokeAllForUser: vi.fn(),
    revokeAllForPlayer: vi.fn(),
    deletePlayer: vi.fn(),
  }));

vi.mock("@/db", () => ({ Q }));
vi.mock("@/services/player", () => ({ playerService: { bans } }));
vi.mock("@/services/player/deletion", () => ({
  playerDeletionService: { delete: deletePlayer },
}));
vi.mock("@/services", () => ({
  getService: vi.fn().mockResolvedValue({
    guilds: { cache: { first: () => undefined } },
  }),
  Services: {},
}));
vi.mock("@/services/auth/session/session.service", () => ({
  sessionService: { revokeAllForUser },
}));
vi.mock("@/services/auth/launcher/launcher-session.service", () => ({
  launcherSessionService: { revokeAllForPlayer },
}));
vi.mock("@/services/discord/oauth/oauth.service", async () => ({
  AuthRole: (
    await vi.importActual<typeof import("@createrington/shared/auth")>(
      "@createrington/shared/auth",
    )
  ).AuthRole,
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn().mockResolvedValue(true) },
}));
vi.mock("@/utils/rcon", () => ({
  minecraftRcon: rcon,
  WhitelistAction: { ADD: "add", REMOVE: "remove" },
}));
vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "1" } },
    Messages: { send: vi.fn() },
  },
}));
vi.mock("@/discord/embeds", () => ({
  EmbedColors: { Success: 0 },
  EmbedPresets: { plain: () => ({ build: () => [] }) },
}));

import { bansRouter } from "@/trpc/routers/admin/players/bans";
import { AuthRole } from "@createrington/shared/auth";
import { BAN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import type { Context } from "@/trpc/context";

const EXPIRES_AT = new Date("2026-11-01T00:00:00.000Z");

const PLAYER = {
  discordId: "100000000000000001",
  minecraftUsername: "steve",
  minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const caller = bansRouter.createCaller({
  user: {
    discordId: "100000000000000009",
    minecraftUsername: "admin",
    minecraftUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    role: AuthRole.ADMIN,
    isAdmin: true,
  },
  service: null,
  ip: "127.0.0.1",
} as unknown as Context);

beforeEach(() => {
  vi.clearAllMocks();
  Q.player.get.mockResolvedValue(PLAYER);
  Q.player.find.mockResolvedValue(PLAYER);
  Q.player.ban.get.mockResolvedValue({
    id: 1,
    reason: "griefing",
    expiresAt: EXPIRES_AT,
    playerMinecraftUuid: PLAYER.minecraftUuid,
  });
  bans.issueTemporary.mockImplementation(
    async (_id, _data, _admin, _name, beforeCommit: BeforeCommit) => {
      await beforeCommit?.();
      return { id: 1, playerMinecraftUuid: PLAYER.minecraftUuid };
    },
  );
  bans.unban.mockImplementation(
    async (_banId, _admin, _name, _reason, beforeCommit: BeforeCommit) => {
      await beforeCommit?.();
      return { id: 1 };
    },
  );
  bans.createPermanent.mockResolvedValue({ id: 2 });
  deletePlayer.mockImplementation(
    async (
      _id,
      options: {
        beforeDelete: (tx: unknown, player: unknown) => Promise<void>;
      },
    ) => {
      await options.beforeDelete({}, PLAYER);
    },
  );
  rcon.whitelistAll.mockResolvedValue(new Map());
  rcon.banAll.mockResolvedValue(new Map());
  rcon.pardonAll.mockResolvedValue(new Map());
});

describe("admin.players.bans.issueTemporary", () => {
  const input = {
    id: PLAYER.minecraftUuid,
    reason: "griefing",
    durationDays: 7,
  };

  it("rejects a reason longer than the ban cap before touching the server", async () => {
    await expect(
      caller.issueTemporary({
        ...input,
        reason: "x".repeat(BAN_REASON_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(bans.issueTemporary).not.toHaveBeenCalled();
    expect(rcon.banAll).not.toHaveBeenCalled();
  });

  it("bans in game before the ban is committed, then revokes sessions", async () => {
    await caller.issueTemporary(input);

    expect(rcon.banAll).toHaveBeenCalledWith(
      PLAYER.minecraftUsername,
      expect.stringContaining("griefing"),
    );
    expect(revokeAllForUser).toHaveBeenCalledWith(PLAYER.discordId);
    expect(revokeAllForPlayer).toHaveBeenCalledWith(PLAYER.minecraftUuid);
    expect(rcon.pardonAll).not.toHaveBeenCalled();
  });

  it("fails the whole ban when the in-game ban fails, and undoes it in game", async () => {
    rcon.banAll.mockRejectedValue(new Error("ban failed on: Rails 'n Sails"));

    await expect(caller.issueTemporary(input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(rcon.pardonAll).toHaveBeenCalledWith(PLAYER.minecraftUsername);
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it("undoes the in-game ban when the ban fails to commit afterwards", async () => {
    bans.issueTemporary.mockImplementation(
      async (_id, _data, _admin, _name, beforeCommit: BeforeCommit) => {
        await beforeCommit?.();
        throw new Error("commit failed");
      },
    );

    await expect(caller.issueTemporary(input)).rejects.toThrow("commit failed");
    expect(rcon.pardonAll).toHaveBeenCalledWith(PLAYER.minecraftUsername);
  });

  it("leaves the game alone when the ban is refused before the in-game step", async () => {
    bans.issueTemporary.mockRejectedValue(
      new Error("Player is already banned"),
    );

    await expect(caller.issueTemporary(input)).rejects.toThrow(
      "Player is already banned",
    );
    expect(rcon.banAll).not.toHaveBeenCalled();
    expect(rcon.pardonAll).not.toHaveBeenCalled();
  });
});

describe("admin.players.bans.issuePermanent", () => {
  const input = { id: PLAYER.minecraftUuid, reason: "griefing" };

  it("removes the whitelist entry and bans in game inside the deletion", async () => {
    const result = await caller.issuePermanent(input);

    expect(result).toEqual({ banId: 2 });
    expect(rcon.whitelistAll).toHaveBeenCalledWith(
      "remove",
      PLAYER.minecraftUsername,
    );
    expect(rcon.banAll).toHaveBeenCalled();
  });

  it("aborts the deletion when the in-game ban fails, and restores the whitelist entry", async () => {
    rcon.banAll.mockRejectedValue(new Error("ban failed on: Rails 'n Sails"));

    await expect(caller.issuePermanent(input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(rcon.pardonAll).toHaveBeenCalledWith(PLAYER.minecraftUsername);
    expect(rcon.whitelistAll).toHaveBeenLastCalledWith(
      "add",
      PLAYER.minecraftUsername,
    );
  });
});

describe("admin.players.bans.unban", () => {
  const input = { banId: 1, reason: "appeal accepted" };

  it("keeps the ban when the in-game pardon fails, and bans again in game", async () => {
    rcon.pardonAll.mockRejectedValue(
      new Error("pardon failed on: Rails 'n Sails"),
    );

    await expect(caller.unban(input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(rcon.banAll).toHaveBeenCalledWith(
      PLAYER.minecraftUsername,
      `griefing (Expires: ${EXPIRES_AT.toISOString()})`,
    );
  });

  it("caps an older over-long reason when banning again in game", async () => {
    Q.player.ban.get.mockResolvedValue({
      id: 1,
      reason: "x".repeat(BAN_REASON_MAX_LENGTH + 200),
      expiresAt: EXPIRES_AT,
      playerMinecraftUuid: PLAYER.minecraftUuid,
    });
    rcon.pardonAll.mockRejectedValue(new Error("pardon failed"));

    await expect(caller.unban(input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(rcon.banAll).toHaveBeenCalledWith(
      PLAYER.minecraftUsername,
      `${"x".repeat(BAN_REASON_MAX_LENGTH)} (Expires: ${EXPIRES_AT.toISOString()})`,
    );
  });

  it("lifts the ban without an in-game step when the player row is gone", async () => {
    Q.player.find.mockResolvedValue(null);

    await caller.unban(input);

    expect(bans.unban).toHaveBeenCalledWith(
      1,
      "100000000000000009",
      "admin",
      "appeal accepted",
      undefined,
    );
    expect(rcon.pardonAll).not.toHaveBeenCalled();
  });
});
