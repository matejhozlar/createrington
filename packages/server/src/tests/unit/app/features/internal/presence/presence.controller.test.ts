import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

const { getServiceMock, findServerMock } = vi.hoisted(() => ({
  getServiceMock: vi.fn(),
  findServerMock: vi.fn(),
}));

vi.mock("@/services", () => ({
  getService: getServiceMock,
  Services: { PLAYTIME_MANAGER_SERVICE: "PLAYTIME_MANAGER_SERVICE" },
}));

vi.mock("@/db", () => ({
  Q: { server: { find: findServerMock, createAndReturn: vi.fn() } },
}));

import { BadRequestError } from "@/app/middleware/error-handler";
import { InternalPresenceController } from "@/app/features/internal/presence/presence.controller";
import type { Request, Response } from "express";

const TEST_SERVER_ID = 7;
const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";

function makeRes(): Response & { json: ReturnType<typeof vi.fn> } {
  return { json: vi.fn() } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
  };
}

function makePlaytimeManager() {
  const service = {
    handlePlayerJoinFromMod: vi.fn(),
    handlePlayerLeaveFromMod: vi.fn(),
    reconcileWithHeartbeat: vi.fn().mockReturnValue({ ended: 1, started: 2 }),
  };
  const ensureService = vi.fn().mockResolvedValue(service);
  getServiceMock.mockResolvedValue({ ensureService });
  return { service, ensureService };
}

beforeEach(() => {
  getServiceMock.mockReset();
  findServerMock.mockReset().mockResolvedValue({ id: TEST_SERVER_ID });
});

describe("InternalPresenceController.handleSyncedPresence", () => {
  it("rejects a payload missing uuid, username or state", async () => {
    const req = {
      body: { uuid: PLAYER_UUID, state: "joined" },
    } as unknown as Request;

    await expect(
      InternalPresenceController.handleSyncedPresence(req, makeRes()),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("starts a session on the test server through its playtime service", async () => {
    const { service, ensureService } = makePlaytimeManager();
    const res = makeRes();
    const req = {
      body: {
        uuid: PLAYER_UUID,
        minecraftUsername: "steve",
        state: "joined",
        timestamp: "2026-09-16T10:00:00.000Z",
        playTimeTicks: 500,
      },
    } as unknown as Request;

    await InternalPresenceController.handleSyncedPresence(req, res);

    expect(ensureService).toHaveBeenCalledWith(TEST_SERVER_ID);
    expect(service.handlePlayerJoinFromMod).toHaveBeenCalledWith({
      uuid: PLAYER_UUID,
      username: "steve",
      timestamp: new Date("2026-09-16T10:00:00.000Z"),
      playTimeTicks: 500,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          state: "joined",
          serverId: TEST_SERVER_ID,
        }),
      }),
    );
  });

  it("ends a session through the same service", async () => {
    const { service } = makePlaytimeManager();
    const req = {
      body: {
        uuid: PLAYER_UUID,
        minecraftUsername: "steve",
        state: "left",
        timestamp: "2026-09-16T11:00:00.000Z",
      },
    } as unknown as Request;

    await InternalPresenceController.handleSyncedPresence(req, makeRes());

    expect(service.handlePlayerLeaveFromMod).toHaveBeenCalledWith({
      uuid: PLAYER_UUID,
      username: "steve",
      timestamp: new Date("2026-09-16T11:00:00.000Z"),
      playTimeTicks: undefined,
    });
    expect(service.handlePlayerJoinFromMod).not.toHaveBeenCalled();
  });
});

describe("InternalPresenceController.handleSyncedHeartbeat", () => {
  it("rejects a heartbeat whose players field is not an array", async () => {
    const req = { body: { players: "steve" } } as unknown as Request;

    await expect(
      InternalPresenceController.handleSyncedHeartbeat(req, makeRes()),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("reconciles the roster through the playtime service and reports the counts", async () => {
    const { service } = makePlaytimeManager();
    const res = makeRes();
    const req = {
      body: {
        players: [
          { uuid: PLAYER_UUID, minecraftUsername: "steve", playTimeTicks: 500 },
          { uuid: "not-a-uuid", minecraftUsername: "ghost" },
        ],
      },
    } as unknown as Request;

    await InternalPresenceController.handleSyncedHeartbeat(req, res);

    expect(service.reconcileWithHeartbeat).toHaveBeenCalledWith([
      { uuid: PLAYER_UUID, username: "steve", playTimeTicks: 500 },
    ]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          playersReported: 1,
          sessionsEnded: 1,
          sessionsStarted: 2,
        }),
      }),
    );
  });
});
