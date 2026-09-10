import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

const { getServiceMock, isInMaintenanceMock } = vi.hoisted(() => ({
  getServiceMock: vi.fn(),
  isInMaintenanceMock: vi.fn(),
}));

vi.mock("@/services", () => ({
  getService: getServiceMock,
  Services: { PLAYTIME_MANAGER_SERVICE: "PLAYTIME_MANAGER_SERVICE" },
}));

vi.mock("@/services/maintenance", () => ({
  maintenanceService: { isInMaintenance: isInMaintenanceMock },
}));

vi.mock("@/services/playtime/config", () => ({
  MINECRAFT_SERVERS: {
    1: {
      id: 1,
      name: "Rails 'n Sails",
      slug: "rails",
      ip: "10.0.0.1",
      port: 25565,
      maxPlayers: 20,
    },
    2: {
      id: 2,
      name: "Test Server",
      slug: "test",
      ip: "10.0.0.2",
      port: 25566,
      maxPlayers: 10,
    },
  },
}));

import { BadRequestError, NotFoundError } from "@/app/middleware/error-handler";
import {
  ServersController,
  type ServerStatusResponse,
} from "@/app/features/servers/servers.controller";
import type { Request, Response } from "express";

type MockRes = Response & {
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
};

function makeRes(): MockRes {
  return { json: vi.fn(), setHeader: vi.fn() } as unknown as MockRes;
}

function makeReq(query: Record<string, unknown> = {}): Request {
  return { query } as unknown as Request;
}

function makePlaytimeService(sessions: number, initialized = true) {
  return {
    getActiveSessions: () =>
      Array.from({ length: sessions }, (_, i) => ({
        uuid: `uuid-${i}`,
        username: `player${i}`,
        serverId: 1,
        sessionStart: new Date(),
      })),
    getStatus: () => ({ isInitialized: initialized }),
    getSessionDuration: () => 0,
  };
}

function mockManager(
  services: Record<number, ReturnType<typeof makePlaytimeService>>,
) {
  getServiceMock.mockResolvedValue({
    getService: (id: number) => services[id],
  });
}

function responseBody(res: MockRes): ServerStatusResponse {
  return res.json.mock.calls[0][0] as ServerStatusResponse;
}

beforeEach(() => {
  getServiceMock.mockReset();
  isInMaintenanceMock.mockReset().mockReturnValue(false);
});

describe("ServersController.getStatus", () => {
  it("returns every configured server with player counts and a total", async () => {
    mockManager({ 1: makePlaytimeService(3), 2: makePlaytimeService(1) });
    const res = makeRes();

    await ServersController.getStatus(makeReq(), res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=10",
    );
    const body = responseBody(res);
    expect(body.servers).toEqual([
      {
        id: 1,
        slug: "rails",
        name: "Rails 'n Sails",
        status: "online",
        maintenance: false,
        playerCount: 3,
        maxPlayers: 20,
      },
      {
        id: 2,
        slug: "test",
        name: "Test Server",
        status: "online",
        maintenance: false,
        playerCount: 1,
        maxPlayers: 10,
      },
    ]);
    expect(body.totalPlayers).toBe(4);
    expect(new Date(body.checkedAt).toISOString()).toBe(body.checkedAt);
  });

  it("narrows the list to a single server by slug", async () => {
    mockManager({ 1: makePlaytimeService(3), 2: makePlaytimeService(1) });
    const res = makeRes();

    await ServersController.getStatus(makeReq({ server: "test" }), res);

    const body = responseBody(res);
    expect(body.servers).toHaveLength(1);
    expect(body.servers[0]).toMatchObject({ slug: "test", playerCount: 1 });
    expect(body.totalPlayers).toBe(1);
  });

  it("reports unknown status with zero players when no playtime service exists", async () => {
    mockManager({ 1: makePlaytimeService(2) });
    const res = makeRes();

    await ServersController.getStatus(makeReq(), res);

    const body = responseBody(res);
    expect(body.servers[1]).toMatchObject({
      slug: "test",
      status: "unknown",
      playerCount: 0,
    });
    expect(body.totalPlayers).toBe(2);
  });

  it("reports offline when the playtime service is not initialized", async () => {
    mockManager({ 1: makePlaytimeService(0, false) });
    const res = makeRes();

    await ServersController.getStatus(makeReq({ server: "rails" }), res);

    expect(responseBody(res).servers[0]).toMatchObject({
      status: "offline",
      playerCount: 0,
    });
  });

  it("reflects the maintenance flag per server", async () => {
    mockManager({ 1: makePlaytimeService(1), 2: makePlaytimeService(1) });
    isInMaintenanceMock.mockImplementation((id: number) => id === 1);
    const res = makeRes();

    await ServersController.getStatus(makeReq(), res);

    const body = responseBody(res);
    expect(body.servers[0].maintenance).toBe(true);
    expect(body.servers[1].maintenance).toBe(false);
  });

  it("rejects a malformed server slug before touching the playtime manager", async () => {
    await expect(
      ServersController.getStatus(
        makeReq({ server: "Rails N Sails" }),
        makeRes(),
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      ServersController.getStatus(makeReq({ server: ["a", "b"] }), makeRes()),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown server slug", async () => {
    await expect(
      ServersController.getStatus(makeReq({ server: "nope" }), makeRes()),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });
});
