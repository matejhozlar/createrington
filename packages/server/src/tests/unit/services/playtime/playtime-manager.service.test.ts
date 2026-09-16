import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { connectMock, getOpenSessionsMock, flushMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  getOpenSessionsMock: vi.fn(),
  flushMock: vi.fn(),
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
  getPlaytimeForwarder: () => null,
}));

import { PlaytimeManagerService } from "@/services/playtime/playtime-manager.service";
import { PlaytimeService } from "@/services/playtime/playtime.service";

const SERVER_ID = 7;
const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";

let manager: PlaytimeManagerService;

beforeEach(() => {
  connectMock.mockReset();
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
});
