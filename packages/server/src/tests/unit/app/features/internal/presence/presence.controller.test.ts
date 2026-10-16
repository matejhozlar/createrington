import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", async () => ({
  ...(await vi.importActual("@/app/middleware/error-handler")),
  ...(await vi.importActual("@/app/middleware/validation.middleware")),
}));

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

import {
  HeartbeatBodySchema,
  PresenceBodySchema,
} from "@/app/features/mod/presence/presence.schemas";
import type { Request, Response } from "express";

const TEST_SERVER_ID = 7;
const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";

async function loadController() {
  vi.resetModules();
  const module =
    await import("@/app/features/internal/presence/presence.controller");
  return module.InternalPresenceController;
}

const req = {} as Request;

function makeRes(body: unknown): Response & { json: ReturnType<typeof vi.fn> } {
  return {
    json: vi.fn(),
    locals: { validated: { body } },
  } as unknown as Response & {
    json: ReturnType<typeof vi.fn>;
  };
}

function presenceRes(body: Record<string, unknown>) {
  return makeRes(PresenceBodySchema.parse(body));
}

function heartbeatRes(body: Record<string, unknown>) {
  return makeRes(HeartbeatBodySchema.parse(body));
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
  it("rejects an unparseable timestamp before touching the tracker", async () => {
    const controller = await loadController();

    await expect(
      controller.handleSyncedPresence(
        req,
        presenceRes({ ...joinBody, timestamp: "yesterday-ish" }),
      ),
    ).rejects.toThrow("Invalid timestamp");
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("starts a session on the test server through its playtime service", async () => {
    const controller = await loadController();
    const { service, ensureService } = makePlaytimeManager();
    const res = presenceRes(joinBody);

    await controller.handleSyncedPresence(req, res);

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
      req,
      presenceRes({
        uuid: PLAYER_UUID,
        minecraftUsername: "steve",
        state: "left",
        timestamp: "2026-09-16T11:00:00.000Z",
      }),
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

    await controller.handleSyncedPresence(req, presenceRes(joinBody));

    expect(createServerMock).toHaveBeenCalledWith({
      name: "Rails 'n Sails (Test)",
      identifier: "rails-test",
    });
    expect(ensureService).toHaveBeenCalledWith(9);
  });

  it("looks the test server up once per process", async () => {
    const controller = await loadController();
    makePlaytimeManager();

    await controller.handleSyncedPresence(req, presenceRes(joinBody));
    await controller.handleSyncedPresence(req, presenceRes(joinBody));

    expect(findServerMock).toHaveBeenCalledTimes(1);
  });
});

describe("InternalPresenceController.handleSyncedHeartbeat", () => {
  it("reconciles the roster through the playtime service and reports the counts", async () => {
    const controller = await loadController();
    const { service } = makePlaytimeManager();
    const res = heartbeatRes({
      players: [
        { uuid: PLAYER_UUID, minecraftUsername: "steve", playTimeTicks: 500 },
        { uuid: "not-a-uuid", minecraftUsername: "ghost" },
      ],
    });

    await controller.handleSyncedHeartbeat(req, res);

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
