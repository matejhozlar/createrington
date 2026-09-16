import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

const { getServiceMock, findServerMock, createServerMock } = vi.hoisted(() => ({
  getServiceMock: vi.fn(),
  findServerMock: vi.fn(),
  createServerMock: vi.fn(),
}));

vi.mock("@/services", () => ({
  getService: getServiceMock,
  Services: { PLAYTIME_MANAGER_SERVICE: "PLAYTIME_MANAGER_SERVICE" },
}));

vi.mock("@/db", () => ({
  Q: { server: { find: findServerMock, createAndReturn: createServerMock } },
}));

import type { Request, Response } from "express";

const TEST_SERVER_ID = 7;
const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";

async function loadController() {
  vi.resetModules();
  const module =
    await import("@/app/features/internal/presence/presence.controller");
  return module.InternalPresenceController;
}

function makeRes(): Response & { json: ReturnType<typeof vi.fn> } {
  return { json: vi.fn() } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
  };
}

function makeReq(body: Record<string, unknown>): Request {
  return { body } as unknown as Request;
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

const joinBody = {
  uuid: PLAYER_UUID,
  minecraftUsername: "steve",
  state: "joined",
  timestamp: "2026-09-16T10:00:00.000Z",
  playTimeTicks: 500,
};

beforeEach(() => {
  getServiceMock.mockReset();
  findServerMock.mockReset().mockResolvedValue({ id: TEST_SERVER_ID });
  createServerMock.mockReset();
});

describe("InternalPresenceController.handleSyncedPresence", () => {
  it("rejects a payload missing uuid, username or state", async () => {
    const controller = await loadController();

    await expect(
      controller.handleSyncedPresence(
        makeReq({ uuid: PLAYER_UUID, state: "joined" }),
        makeRes(),
      ),
    ).rejects.toThrow("uuid, minecraftUsername, and state are required");
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("rejects a state other than joined or left", async () => {
    const controller = await loadController();

    await expect(
      controller.handleSyncedPresence(
        makeReq({ ...joinBody, state: "afk" }),
        makeRes(),
      ),
    ).rejects.toThrow('state must be either "joined" or "left"');
  });

  it("rejects an unparseable timestamp before touching the tracker", async () => {
    const controller = await loadController();

    await expect(
      controller.handleSyncedPresence(
        makeReq({ ...joinBody, timestamp: "yesterday-ish" }),
        makeRes(),
      ),
    ).rejects.toThrow("Invalid timestamp");
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("starts a session on the test server through its playtime service", async () => {
    const controller = await loadController();
    const { service, ensureService } = makePlaytimeManager();
    const res = makeRes();

    await controller.handleSyncedPresence(makeReq(joinBody), res);

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
    const controller = await loadController();
    const { service } = makePlaytimeManager();

    await controller.handleSyncedPresence(
      makeReq({
        uuid: PLAYER_UUID,
        minecraftUsername: "steve",
        state: "left",
        timestamp: "2026-09-16T11:00:00.000Z",
      }),
      makeRes(),
    );

    expect(service.handlePlayerLeaveFromMod).toHaveBeenCalledWith({
      uuid: PLAYER_UUID,
      username: "steve",
      timestamp: new Date("2026-09-16T11:00:00.000Z"),
      playTimeTicks: undefined,
    });
    expect(service.handlePlayerJoinFromMod).not.toHaveBeenCalled();
  });

  it("creates the test server row when it does not exist yet", async () => {
    const controller = await loadController();
    const { ensureService } = makePlaytimeManager();
    findServerMock.mockResolvedValue(null);
    createServerMock.mockResolvedValue({ id: 9 });

    await controller.handleSyncedPresence(makeReq(joinBody), makeRes());

    expect(createServerMock).toHaveBeenCalledWith({
      name: "Rails 'n Sails (Test)",
      identifier: "rails-test",
    });
    expect(ensureService).toHaveBeenCalledWith(9);
  });

  it("looks the test server up once per process", async () => {
    const controller = await loadController();
    makePlaytimeManager();

    await controller.handleSyncedPresence(makeReq(joinBody), makeRes());
    await controller.handleSyncedPresence(makeReq(joinBody), makeRes());

    expect(findServerMock).toHaveBeenCalledTimes(1);
  });
});

describe("InternalPresenceController.handleSyncedHeartbeat", () => {
  it("rejects a heartbeat whose players field is not an array", async () => {
    const controller = await loadController();

    await expect(
      controller.handleSyncedHeartbeat(
        makeReq({ players: "steve" }),
        makeRes(),
      ),
    ).rejects.toThrow("players must be an array");
  });

  it("reconciles the roster through the playtime service and reports the counts", async () => {
    const controller = await loadController();
    const { service } = makePlaytimeManager();
    const res = makeRes();

    await controller.handleSyncedHeartbeat(
      makeReq({
        players: [
          { uuid: PLAYER_UUID, minecraftUsername: "steve", playTimeTicks: 500 },
          { uuid: "not-a-uuid", minecraftUsername: "ghost" },
        ],
      }),
      res,
    );

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
