import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { markJoinedMinecraft } = vi.hoisted(() => ({
  markJoinedMinecraft: vi.fn(),
}));

vi.mock("@/services/waitlist/progress-embed", () => ({ markJoinedMinecraft }));

vi.mock("@/services/discord/message/cache", () => ({
  MessageSource: { SYSTEM: "system" },
}));

vi.mock("@/services/mc-server/servers", () => ({ SERVERS: [] }));

vi.mock("@/services/playtime/forwarder.service", () => ({
  getPlaytimeForwarder: () => ({ connectToService: vi.fn() }),
}));

import { PlaytimePersistence } from "@/services/playtime/persistence";
import { PlaytimeService } from "@/services/playtime/playtime.service";

const SERVER_ID = 1;
const STEVE = "11111111-2222-3333-4444-555555555555";
const T0 = new Date("2026-09-14T10:00:00Z");
const ticks = (playedSeconds: number) => playedSeconds * 20;

function makeWriter() {
  return {
    startSession: vi.fn(),
    progressSession: vi.fn(),
    endSession: vi.fn(),
  };
}

function sessionOf(service: PlaytimeService, uuid: string) {
  return service.getActiveSessions().find((session) => session.uuid === uuid);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("PlaytimePersistence", () => {
  function startedService() {
    const service = new PlaytimeService({
      serverId: SERVER_ID,
      staleAfterMs: 15 * 60 * 1000,
      watchdogIntervalMs: 60 * 1000,
    });
    const writer = makeWriter();
    const persistence = new PlaytimePersistence(writer);
    persistence.connect(service, SERVER_ID);
    service.initialize();
    return { service, writer, persistence };
  }

  it("hands the stored session id back and completes the waitlist step", async () => {
    const { service, writer, persistence } = startedService();
    writer.startSession.mockResolvedValue({
      sessionId: 42,
      discordId: "discord-steve",
    });

    service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(1000),
    });
    await persistence.flush(1000);

    expect(sessionOf(service, STEVE)?.sessionId).toBe(42);
    expect(markJoinedMinecraft).toHaveBeenCalledWith("discord-steve");
    service.shutdown();
  });

  it("skips the waitlist step for an unregistered player", async () => {
    const { service, writer, persistence } = startedService();
    writer.startSession.mockResolvedValue(null);

    service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(1000),
    });
    await persistence.flush(1000);

    expect(markJoinedMinecraft).not.toHaveBeenCalled();
    service.shutdown();
  });

  it("hands a failed heartbeat write back to the service for the next heartbeat", async () => {
    const { service, writer, persistence } = startedService();
    writer.startSession.mockResolvedValue({
      sessionId: 42,
      discordId: "discord-steve",
    });
    writer.progressSession.mockRejectedValue(new Error("credit failed"));

    service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(1000),
    });
    await persistence.flush(1000);
    expect(sessionOf(service, STEVE)?.sessionId).toBe(42);

    vi.setSystemTime(new Date(T0.getTime() + 60_000));
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(1060) },
    ]);
    await persistence.flush(1000);

    expect(writer.progressSession).toHaveBeenCalledTimes(1);
    expect(sessionOf(service, STEVE)).toMatchObject({
      creditedUntil: T0,
      lastPlayTicks: ticks(1000),
      activeSeconds: 0,
    });
    service.shutdown();
  });
});
