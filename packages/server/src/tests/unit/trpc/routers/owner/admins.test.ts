import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  Q,
  member,
  invalidate,
  revokeAllForUser,
  assignRole,
  removeRole,
  sendAll,
  getService,
} = vi.hoisted(() => {
  const member = { roles: { cache: { has: vi.fn() } } };
  return {
    Q: {
      admin: {
        find: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        log: { action: { logAction: vi.fn() } },
      },
      player: { find: vi.fn() },
    },
    member,
    invalidate: vi.fn(),
    revokeAllForUser: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    sendAll: vi.fn(),
    getService: vi.fn(),
  };
});

const { OWNER_ID } = vi.hoisted(() => ({ OWNER_ID: "100000000000000009" }));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  const { app } = actual.default;
  return {
    ...actual,
    default: {
      ...actual.default,
      app: {
        ...app,
        auth: {
          ...app.auth,
          owner: { ...app.auth.owner, discordId: OWNER_ID },
        },
      },
    },
  };
});
vi.mock("@/db", () => ({ Q }));
vi.mock("@/services", () => ({
  getService,
  Services: { DISCORD_MAIN_BOT: "discord.mainBot" },
}));
vi.mock("@/services/auth/session/session.service", () => ({
  sessionService: { revokeAllForUser },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn(), invalidate },
}));
vi.mock("@/discord/utils/roles/role-manager", () => ({
  RoleManager: { assign: assignRole, remove: removeRole },
}));
vi.mock("@/discord/constants", () => ({
  Discord: { Roles: { ADMIN: "admin-role" } },
}));
vi.mock("@/utils/rcon", () => ({ minecraftRcon: { sendAll } }));
vi.mock("@/services/playtime/config", () => ({
  MINECRAFT_SERVERS: { 1: {} },
}));

import { TRPCError } from "@trpc/server";
import { AuthRole } from "@createrington/shared/auth";
import { ownerAdminsRouter } from "@/trpc/routers/owner/admins";
import type { Context } from "@/trpc/context";

const TARGET_ID = "100000000000000001";
const TARGET = {
  discordId: TARGET_ID,
  minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  minecraftUsername: "Steve",
};

function callerFor(discordId: string) {
  return ownerAdminsRouter.createCaller({
    user: {
      discordId,
      username: "owner",
      minecraftUsername: "Owner",
      minecraftUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      role: AuthRole.ADMIN,
      isAdmin: true,
    },
    service: null,
    ip: "127.0.0.1",
  } satisfies Context);
}

const owner = callerFor(OWNER_ID);

async function rejection(call: Promise<unknown>): Promise<TRPCError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected the call to be rejected");
}

beforeEach(() => {
  vi.clearAllMocks();
  Q.player.find.mockResolvedValue(TARGET);
  Q.admin.find.mockResolvedValue(null);
  member.roles.cache.has.mockReturnValue(true);
  getService.mockResolvedValue({
    guilds: {
      cache: {
        first: () => ({
          members: { fetch: vi.fn().mockResolvedValue(member) },
        }),
      },
    },
  });
  assignRole.mockResolvedValue(true);
  removeRole.mockResolvedValue(true);
  sendAll.mockResolvedValue(new Map([[1, { success: true }]]));
});

describe("owner.admins access", () => {
  it.each([
    ["promote", () => callerFor(TARGET_ID).promote({ discordId: TARGET_ID })],
    ["demote", () => callerFor(TARGET_ID).demote({ discordId: OWNER_ID })],
  ])("refuses %s to an admin who is not the owner", async (_label, call) => {
    const error = await rejection(call());

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Owner access required",
    });
    expect(Q.admin.create).not.toHaveBeenCalled();
    expect(Q.admin.delete).not.toHaveBeenCalled();
  });
});

describe("owner.admins.promote", () => {
  it("stores the admin, drops the cached admin status, grants the Discord role and audits it", async () => {
    const result = await owner.promote({
      discordId: TARGET_ID,
      reason: "trusted builder",
    });

    expect(result).toEqual({
      discordRoleAdded: true,
      minecraftUsername: "Steve",
    });
    expect(Q.admin.create).toHaveBeenCalledWith({ discordId: TARGET_ID });
    expect(invalidate).toHaveBeenCalledWith(TARGET_ID);
    expect(assignRole).toHaveBeenCalledWith(
      member,
      "admin-role",
      "trusted builder",
    );
    expect(Q.admin.log.action.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminDiscordId: OWNER_ID,
        actionType: "admin_promote",
        targetPlayerUuid: TARGET.minecraftUuid,
        reason: "trusted builder",
        metadata: { discordRoleAdded: true },
      }),
    );
  });

  it("leaves the in-game op to the owner", async () => {
    await owner.promote({ discordId: TARGET_ID });

    expect(sendAll).not.toHaveBeenCalled();
  });

  it("refuses someone who is already an admin", async () => {
    Q.admin.find.mockResolvedValue({ discordId: TARGET_ID });

    const error = await rejection(owner.promote({ discordId: TARGET_ID }));

    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "User is already an admin",
    });
    expect(Q.admin.create).not.toHaveBeenCalled();
  });

  it("still promotes when Discord cannot be reached", async () => {
    getService.mockRejectedValue(new Error("bot offline"));

    const result = await owner.promote({ discordId: TARGET_ID });

    expect(result.discordRoleAdded).toBe(false);
    expect(Q.admin.create).toHaveBeenCalledWith({ discordId: TARGET_ID });
    expect(Q.admin.log.action.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { discordRoleAdded: false } }),
    );
  });
});

describe("owner.admins.demote", () => {
  beforeEach(() => {
    Q.admin.find.mockResolvedValue({ discordId: TARGET_ID });
  });

  it("removes the admin, signs them out, drops the Discord role, deops them and audits it", async () => {
    const result = await owner.demote({
      discordId: TARGET_ID,
      reason: "inactive",
    });

    expect(result).toEqual({
      removedFromDb: true,
      discordRoleRemoved: true,
      rconResults: [{ serverId: 1, success: true, error: undefined }],
      minecraftUsername: "Steve",
    });
    expect(Q.admin.delete).toHaveBeenCalledWith({ discordId: TARGET_ID });
    expect(invalidate).toHaveBeenCalledWith(TARGET_ID);
    expect(revokeAllForUser).toHaveBeenCalledWith(TARGET_ID);
    expect(removeRole).toHaveBeenCalledWith(member, "admin-role", "inactive");
    expect(sendAll).toHaveBeenCalledWith("deop Steve");
    expect(Q.admin.log.action.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminDiscordId: OWNER_ID,
        actionType: "admin_demote",
        reason: "inactive",
      }),
    );
  });

  it("refuses to let the owner demote themselves", async () => {
    const error = await rejection(owner.demote({ discordId: OWNER_ID }));

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "You can't demote yourself",
    });
    expect(Q.admin.delete).not.toHaveBeenCalled();
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it("revokes access before the best-effort Discord and RCON steps, and finishes when both fail", async () => {
    getService.mockRejectedValue(new Error("bot offline"));
    sendAll.mockResolvedValue(
      new Map([[1, { success: false, error: new Error("rcon timeout") }]]),
    );

    const result = await owner.demote({ discordId: TARGET_ID });

    expect(Q.admin.delete.mock.invocationCallOrder[0]).toBeLessThan(
      getService.mock.invocationCallOrder[0],
    );
    expect(revokeAllForUser.mock.invocationCallOrder[0]).toBeLessThan(
      getService.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({
      removedFromDb: true,
      discordRoleRemoved: false,
      rconResults: [{ serverId: 1, success: false, error: "rcon timeout" }],
    });
  });

  it("still signs out a user who has the Discord role but no admin row", async () => {
    Q.admin.find.mockResolvedValue(null);

    const result = await owner.demote({ discordId: TARGET_ID });

    expect(result.removedFromDb).toBe(false);
    expect(Q.admin.delete).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith(TARGET_ID);
    expect(revokeAllForUser).toHaveBeenCalledWith(TARGET_ID);
    expect(removeRole).toHaveBeenCalled();
  });

  it("skips the deop when the user has no linked Minecraft account", async () => {
    Q.player.find.mockResolvedValue(null);

    const result = await owner.demote({ discordId: TARGET_ID });

    expect(sendAll).not.toHaveBeenCalled();
    expect(result.rconResults).toEqual([]);
  });
});
