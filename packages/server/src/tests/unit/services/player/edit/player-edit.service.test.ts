import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlayer: vi.fn(),
  findPlayer: vi.fn(),
  playerExists: vi.fn(),
  adminUpdate: vi.fn(),
  findCurrentBan: vi.fn(),
  resolve: vi.fn(),
  whitelistAll: vi.fn(),
  banAll: vi.fn(),
  pardonAll: vi.fn(),
  setNickname: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: {
    player: {
      get: mocks.getPlayer,
      find: mocks.findPlayer,
      exists: mocks.playerExists,
    },
  },
  playerRepo: { adminUpdate: mocks.adminUpdate },
  playerBanRepo: { findCurrent: mocks.findCurrentBan },
}));
vi.mock("@/services/skin-api/client", () => ({
  getSkinApiClient: () => ({ resolve: mocks.resolve }),
}));
vi.mock("@/utils/rcon", () => ({
  minecraftRcon: {
    whitelistAll: mocks.whitelistAll,
    banAll: mocks.banAll,
    pardonAll: mocks.pardonAll,
  },
  WhitelistAction: { ADD: "add", REMOVE: "remove" },
}));
vi.mock("@/discord/utils/fetch-guild-member", () => ({
  fetchGuildMember: vi.fn(async () => ({ setNickname: mocks.setNickname })),
}));
vi.mock("@/services/player/ban", () => ({
  inGameBanReason: (reason: string) => `${reason} (in game)`,
}));

import { SkinApiError } from "createrington-skin-api";
import { PlayerEditService } from "@/services/player/edit/player-edit.service";
import { UniqueViolationError } from "@/db/utils";
import {
  BadRequestError,
  ConflictError,
  ServiceUnavailableError,
} from "@/errors";

const OLD = {
  id: 1,
  discordId: "100000000000000001",
  minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  minecraftUsername: "Steve",
};
const REAL_ACCOUNT = {
  uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  username: "RealSteve",
};
const ACTOR = { discordId: "100000000000000009", username: "Admin" };

const service = new PlayerEditService();

function rename(username = "realsteve") {
  return service.update(
    { minecraftUuid: OLD.minecraftUuid },
    { minecraftUsername: username },
    ACTOR,
    "wrong account at registration",
  );
}

function notFound(): SkinApiError {
  return new SkinApiError("Not found", { code: "not_found", status: 404 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlayer.mockResolvedValue(OLD);
  mocks.findPlayer.mockResolvedValue(null);
  mocks.playerExists.mockResolvedValue(false);
  mocks.resolve.mockResolvedValue(REAL_ACCOUNT);
  mocks.adminUpdate.mockResolvedValue({
    ...OLD,
    minecraftUuid: REAL_ACCOUNT.uuid,
    minecraftUsername: REAL_ACCOUNT.username,
  });
  mocks.findCurrentBan.mockResolvedValue(null);
  mocks.whitelistAll.mockResolvedValue(new Map());
});

describe("PlayerEditService.update with a new username", () => {
  it("moves the player to the resolved account's UUID and canonical name", async () => {
    await rename();

    expect(mocks.adminUpdate).toHaveBeenCalledWith(
      { minecraftUuid: OLD.minecraftUuid },
      {
        minecraftUsername: REAL_ACCOUNT.username,
        minecraftUuid: REAL_ACCOUNT.uuid,
      },
      ACTOR.discordId,
      ACTOR.username,
      "wrong account at registration",
    );
  });

  it("whitelists the new name before the update and removes the old one after", async () => {
    await rename();

    expect(mocks.whitelistAll.mock.calls).toEqual([
      ["add", REAL_ACCOUNT.username],
      ["remove", OLD.minecraftUsername],
    ]);
    expect(mocks.whitelistAll.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.adminUpdate.mock.invocationCallOrder[0],
    );
    expect(mocks.setNickname).toHaveBeenCalledWith(
      REAL_ACCOUNT.username,
      expect.any(String),
    );
  });

  it("refuses a username that resolves to no account", async () => {
    mocks.resolve.mockRejectedValue(notFound());

    await expect(rename("nobody_here")).rejects.toBeInstanceOf(BadRequestError);
    expect(mocks.whitelistAll).not.toHaveBeenCalled();
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });

  it("refuses the change when the lookup itself fails", async () => {
    mocks.resolve.mockRejectedValue(new Error("skin api down"));

    await expect(rename()).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });

  it("refuses an account another player already owns", async () => {
    mocks.findPlayer.mockResolvedValue({ ...OLD, id: 2 });

    await expect(rename()).rejects.toBeInstanceOf(ConflictError);
    expect(mocks.whitelistAll).not.toHaveBeenCalled();
  });

  it("changes nothing when the new name cannot be whitelisted", async () => {
    mocks.whitelistAll.mockRejectedValue(new Error("server offline"));

    await expect(rename()).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });

  it("takes the new name off the whitelist when the update fails", async () => {
    mocks.adminUpdate.mockRejectedValue(
      new UniqueViolationError("duplicate", "player_minecraft_username_unique"),
    );

    await expect(rename()).rejects.toBeInstanceOf(ConflictError);
    expect(mocks.whitelistAll).toHaveBeenLastCalledWith(
      "remove",
      REAL_ACCOUNT.username,
    );
  });

  it("moves an active ban to the new name in game", async () => {
    mocks.findCurrentBan.mockResolvedValue({
      reason: "griefing",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });

    await rename();

    expect(mocks.banAll).toHaveBeenCalledWith(
      REAL_ACCOUNT.username,
      "griefing (in game)",
    );
    expect(mocks.pardonAll).toHaveBeenCalledWith(OLD.minecraftUsername);
  });

  it("leaves the whitelist alone when only the capitalisation changes", async () => {
    mocks.resolve.mockResolvedValue({
      uuid: OLD.minecraftUuid,
      username: "steve",
    });
    mocks.adminUpdate.mockResolvedValue({ ...OLD, minecraftUsername: "steve" });

    await rename("steve");

    expect(mocks.whitelistAll).not.toHaveBeenCalled();
    expect(mocks.adminUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { minecraftUsername: "steve", minecraftUuid: OLD.minecraftUuid },
      ACTOR.discordId,
      ACTOR.username,
      expect.any(String),
    );
  });

  it("touches nothing in game when the account keeps its UUID under a new name", async () => {
    mocks.resolve.mockResolvedValue({
      uuid: OLD.minecraftUuid,
      username: "Alex",
    });
    mocks.adminUpdate.mockResolvedValue({ ...OLD, minecraftUsername: "Alex" });
    mocks.findCurrentBan.mockResolvedValue({
      reason: "griefing",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });

    await rename("alex");

    expect(mocks.adminUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { minecraftUsername: "Alex", minecraftUuid: OLD.minecraftUuid },
      ACTOR.discordId,
      ACTOR.username,
      expect.any(String),
    );
    expect(mocks.whitelistAll).not.toHaveBeenCalled();
    expect(mocks.banAll).not.toHaveBeenCalled();
    expect(mocks.pardonAll).not.toHaveBeenCalled();
    expect(mocks.setNickname).toHaveBeenCalledWith("Alex", expect.any(String));
  });

  it("refuses a name another player is still stored under", async () => {
    mocks.findPlayer.mockImplementation(
      async (filter: { minecraftUsername?: string }) =>
        filter.minecraftUsername === REAL_ACCOUNT.username
          ? { ...OLD, id: 2 }
          : null,
    );

    await expect(rename()).rejects.toThrow(/still stored under the name/);
    expect(mocks.whitelistAll).not.toHaveBeenCalled();
  });

  it("refuses an edit that keeps the same account and Discord ID", async () => {
    mocks.resolve.mockResolvedValue({
      uuid: OLD.minecraftUuid,
      username: OLD.minecraftUsername,
    });

    await expect(rename("Steve")).rejects.toBeInstanceOf(BadRequestError);
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });
});

describe("PlayerEditService.update with a new Discord ID", () => {
  it("refuses a Discord ID another player is registered with", async () => {
    mocks.findPlayer.mockImplementation(
      async (filter: { discordId?: string }) =>
        filter.discordId === "100000000000000002" ? { ...OLD, id: 2 } : null,
    );

    await expect(
      service.update(
        { minecraftUuid: OLD.minecraftUuid },
        { discordId: "100000000000000002" },
        ACTOR,
        "lost account",
      ),
    ).rejects.toThrow(/Discord ID 100000000000000002 is already registered/);
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });
});
