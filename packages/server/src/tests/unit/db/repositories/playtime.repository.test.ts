import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/db", () => ({ db: {}, Q: {}, waitlistRepo: {} }));

vi.mock("@/services/discord/message/cache", () => ({
  MessageSource: { SYSTEM: "system" },
}));

vi.mock("@/services/playtime/config", () => ({ MINECRAFT_SERVERS: {} }));

vi.mock("@/services/playtime/forwarder.service", () => ({
  getPlaytimeForwarder: () => ({ connectToService: vi.fn() }),
}));

import { PlaytimeRepository } from "@/db/repositories/playtime";
import { PlaytimeService } from "@/services/playtime/playtime.service";

const SERVER_ID = 1;
const STEVE = "11111111-2222-3333-4444-555555555555";
const T0 = new Date("2026-09-14T10:00:00Z");
const ticks = (playedSeconds: number) => playedSeconds * 20;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PlaytimeRepository.connectToService", () => {
  it("hands a failed heartbeat write back to the service for the next heartbeat", async () => {
    const service = new PlaytimeService({
      serverId: SERVER_ID,
      staleAfterMs: 15 * 60 * 1000,
      watchdogIntervalMs: 60 * 1000,
    });
    const repo = new PlaytimeRepository();
    vi.spyOn(repo, "startSession").mockResolvedValue(42);
    const progressSpy = vi
      .spyOn(repo, "progressSession")
      .mockRejectedValue(new Error("credit failed"));
    repo.connectToService(service, SERVER_ID);
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(1000),
    });
    await repo.flush(1000);
    expect(service.getSession(STEVE)?.sessionId).toBe(42);

    vi.setSystemTime(new Date(T0.getTime() + 60_000));
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(1060) },
    ]);
    await repo.flush(1000);

    expect(progressSpy).toHaveBeenCalledTimes(1);
    expect(service.getSession(STEVE)).toMatchObject({
      creditedUntil: T0,
      lastPlayTicks: ticks(1000),
      activeSeconds: 0,
    });
  });
});
