import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

const { getServiceMock } = vi.hoisted(() => ({ getServiceMock: vi.fn() }));
vi.mock("@/services", () => ({
  getService: getServiceMock,
  Services: { PLAYTIME_MANAGER_SERVICE: "PLAYTIME_MANAGER_SERVICE" },
}));

vi.mock("@/config", () => ({ default: { sync: {} } }));

vi.mock("@/app/features/mod/shared/resolve-server-id", () => ({
  resolveServerId: () => 1,
}));

import { ForbiddenError } from "@/app/middleware/error-handler";
import { PresenceController } from "@/app/features/mod/presence/presence.controller";
import type { Request, Response } from "express";

const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";
const OTHER_UUID = "99999999-8888-7777-6666-555555555555";

function makeRes(): Response & { json: ReturnType<typeof vi.fn> } {
  return { json: vi.fn() } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
  };
}

function makePlaytimeManager() {
  const playtimeService = {
    handlePlayerJoinFromMod: vi.fn(),
    handlePlayerLeaveFromMod: vi.fn(),
    reconcileWithHeartbeat: vi.fn(),
  };
  getServiceMock.mockResolvedValue({
    getService: () => playtimeService,
  });
  return playtimeService;
}

beforeEach(() => {
  getServiceMock.mockReset();
});

describe("PresenceController.updatePresence", () => {
  const joinBody = {
    minecraftUsername: "steve",
    uuid: PLAYER_UUID,
    state: "joined",
  };

  it("rejects a per-player token whose uuid does not match the reported player", async () => {
    const req = {
      body: joinBody,
      modAuth: { uuid: OTHER_UUID },
    } as unknown as Request;

    await expect(
      PresenceController.updatePresence(req, makeRes()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("accepts a per-player token matching the reported player regardless of case", async () => {
    const playtimeService = makePlaytimeManager();
    const req = {
      body: joinBody,
      modAuth: { uuid: PLAYER_UUID.toUpperCase() },
    } as unknown as Request;
    const res = makeRes();

    await PresenceController.updatePresence(req, res);

    expect(playtimeService.handlePlayerJoinFromMod).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: PLAYER_UUID }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("accepts a server-level token without a uuid claim", async () => {
    const playtimeService = makePlaytimeManager();
    const req = { body: joinBody, modAuth: {} } as unknown as Request;
    const res = makeRes();

    await PresenceController.updatePresence(req, res);

    expect(playtimeService.handlePlayerJoinFromMod).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});

describe("PresenceController.heartbeat", () => {
  it("rejects a per-player token", async () => {
    const req = {
      body: { players: [] },
      modAuth: { uuid: PLAYER_UUID },
    } as unknown as Request;

    await expect(
      PresenceController.heartbeat(req, makeRes()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("accepts a server-level token and reconciles sessions", async () => {
    const playtimeService = makePlaytimeManager();
    const req = {
      body: { players: [{ uuid: PLAYER_UUID, username: "steve" }] },
      modAuth: {},
    } as unknown as Request;
    const res = makeRes();

    await PresenceController.heartbeat(req, res);

    expect(playtimeService.reconcileWithHeartbeat).toHaveBeenCalledWith([
      { uuid: PLAYER_UUID, username: "steve" },
    ]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});
