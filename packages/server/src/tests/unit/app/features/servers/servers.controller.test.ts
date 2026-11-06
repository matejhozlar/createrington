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
import { ServerState } from "@/services/playtime/types";
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

function makePlaytimeService(
  sessions: number,
  state: ServerState = ServerState.ONLINE,
) {
  return {
    getActiveSessions: vi.fn(() =>
      Array.from({ length: sessions }, (_, i) => ({
        uuid: `uuid-${i}`,
        username: `player${i}`,
        serverId: 1,
        sessionStart: new Date(),
      })),
    ),
    getStatus: () => ({
      isInitialized: true,
      activeSessions: sessions,
      serverState: state,
    }),
    getServerState: () => state,
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
    expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
  });

  it("does not build the player list on the public path", async () => {
    const rails = makePlaytimeService(3);
    mockManager({ 1: rails });

    await ServersController.getStatus(makeReq({ server: "rails" }), makeRes());

    expect(rails.getActiveSessions).not.toHaveBeenCalled();
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

  it("treats an empty server filter as no filter", async () => {
    mockManager({ 1: makePlaytimeService(1), 2: makePlaytimeService(1) });
    const res = makeRes();

    await ServersController.getStatus(makeReq({ server: "" }), res);

    expect(responseBody(res).servers).toHaveLength(2);
  });

  it("mirrors the tracked server state, keeping the tracked session count", async () => {
    mockManager({
      1: makePlaytimeService(2, ServerState.OFFLINE),
      2: makePlaytimeService(0, ServerState.UNKNOWN),
    });
    const res = makeRes();

    await ServersController.getStatus(makeReq(), res);

    const body = responseBody(res);
    expect(body.servers[0]).toMatchObject({
      status: "offline",
      playerCount: 2,
    });
    expect(body.servers[1]).toMatchObject({
      status: "unknown",
      playerCount: 0,
    });
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

  it("degrades to unknown status when the playtime manager is unavailable", async () => {
    getServiceMock.mockRejectedValue(
      new Error("No PlaytimeServices initialized"),
    );
    const res = makeRes();

    await ServersController.getStatus(makeReq(), res);

    const body = responseBody(res);
    expect(body.servers.map((server) => server.status)).toEqual([
      "unknown",
      "unknown",
    ]);
    expect(body.totalPlayers).toBe(0);
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
