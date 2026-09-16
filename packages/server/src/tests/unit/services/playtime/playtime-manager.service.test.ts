import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { connectMock, getOpenSessionsMock, flushMock, forwarderConnectMock } =
  vi.hoisted(() => ({
    connectMock: vi.fn(),
    getOpenSessionsMock: vi.fn(),
    flushMock: vi.fn(),
    forwarderConnectMock: vi.fn(),
  }));

vi.mock("@/db", () => ({
  playtimeRepo: {
    connectToService: connectMock,
    getOpenSessions: getOpenSessionsMock,
    flush: flushMock,
  },
}));

vi.mock("@/services/playtime/config", () => ({ MINECRAFT_SERVERS: {} }));

vi.mock("@/services/playtime/forwarder.service", () => ({
  getPlaytimeForwarder: () => ({ connectToService: forwarderConnectMock }),
}));

import { PlaytimeManagerService } from "@/services/playtime/playtime-manager.service";
import { PlaytimeService } from "@/services/playtime/playtime.service";

const SERVER_ID = 7;
const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";

let manager: PlaytimeManagerService;

beforeEach(() => {
  connectMock.mockReset();
  forwarderConnectMock.mockReset();
  getOpenSessionsMock.mockReset().mockResolvedValue([]);
  flushMock.mockReset().mockResolvedValue(undefined);
  manager = new PlaytimeManagerService();
});

afterEach(async () => {
  await manager.shutdown();
});

describe("PlaytimeManagerService.ensureService", () => {
  it("creates, wires and starts a service for a server outside the static config", async () => {
    const service = await manager.ensureService(SERVER_ID);

    expect(service).toBeInstanceOf(PlaytimeService);
    expect(connectMock).toHaveBeenCalledWith(service, SERVER_ID);
    expect(getOpenSessionsMock).toHaveBeenCalledWith(SERVER_ID);
    expect(manager.getService(SERVER_ID)).toBe(service);
  });

  it("does not wire an on-demand service to the forwarder", async () => {
    await manager.ensureService(SERVER_ID);

    expect(forwarderConnectMock).not.toHaveBeenCalled();
  });

  it("shares one bring-up between concurrent callers and reuses it afterwards", async () => {
    const [first, second] = await Promise.all([
      manager.ensureService(SERVER_ID),
      manager.ensureService(SERVER_ID),
    ]);
    const third = await manager.ensureService(SERVER_ID);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(getOpenSessionsMock).toHaveBeenCalledTimes(1);
  });

  it("restores the open sessions the database still holds", async () => {
    getOpenSessionsMock.mockResolvedValue([
      {
        id: 42,
        playerMinecraftUuid: PLAYER_UUID,
        serverId: SERVER_ID,
        sessionStart: new Date("2026-09-16T10:00:00.000Z"),
        lastSeenAt: null,
        lastPlayTicks: null,
        activeSeconds: 0,
        minecraftUsername: "steve",
      },
    ]);

    const service = await manager.ensureService(SERVER_ID);

    expect(service.isPlayerOnline(PLAYER_UUID)).toBe(true);
    expect(service.getSession(PLAYER_UUID)?.sessionId).toBe(42);
  });

  it("retries the bring-up after a failed attempt", async () => {
    getOpenSessionsMock.mockRejectedValueOnce(new Error("db down"));

    await expect(manager.ensureService(SERVER_ID)).rejects.toThrow("db down");
    expect(connectMock).not.toHaveBeenCalled();
    expect(manager.getService(SERVER_ID)).toBeUndefined();

    const service = await manager.ensureService(SERVER_ID);

    expect(service).toBeInstanceOf(PlaytimeService);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(manager.getService(SERVER_ID)).toBe(service);
  });

  it("does not keep a service whose bring-up finishes after shutdown", async () => {
    let release!: (rows: never[]) => void;
    getOpenSessionsMock.mockReturnValue(
      new Promise<never[]>((resolve) => {
        release = resolve;
      }),
    );

    const pending = manager.ensureService(SERVER_ID);
    const shutdown = manager.shutdown();
    release([]);

    await expect(pending).rejects.toThrow(/shut down/);
    await shutdown;
    expect(manager.getService(SERVER_ID)).toBeUndefined();
  });

  it("refuses new bring-ups after shutdown", async () => {
    await manager.shutdown();

    await expect(manager.ensureService(SERVER_ID)).rejects.toThrow(/shut down/);
    expect(getOpenSessionsMock).not.toHaveBeenCalled();
  });
});
