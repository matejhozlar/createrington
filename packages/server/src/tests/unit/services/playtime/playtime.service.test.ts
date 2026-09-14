import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/services/discord/message/cache", () => ({
  MessageSource: { SYSTEM: "system" },
}));

import { PlaytimeService } from "@/services/playtime/playtime.service";
import { ServerState } from "@/services/playtime/types";
import type {
  SessionEndEvent,
  SessionProgressEvent,
  SessionStartEvent,
} from "@/services/playtime/types";

const SERVER_ID = 1;
const STEVE = "11111111-2222-3333-4444-555555555555";
const ALEX = "99999999-8888-7777-6666-555555555555";
const T0 = new Date("2026-09-14T10:00:00Z");

const seconds = (n: number) => n * 1000;
const ticks = (playedSeconds: number) => playedSeconds * 20;

function makeService(overrides: { staleAfterMs?: number } = {}) {
  const service = new PlaytimeService({
    serverId: SERVER_ID,
    staleAfterMs: overrides.staleAfterMs ?? 15 * 60 * 1000,
    watchdogIntervalMs: 60 * 1000,
  });

  const starts: SessionStartEvent[] = [];
  const progress: SessionProgressEvent[] = [];
  const ends: SessionEndEvent[] = [];
  service.on("sessionStart", (e) => starts.push(e));
  service.on("sessionProgress", (e) => progress.push(e));
  service.on("sessionEnd", (e) => ends.push(e));

  return { service, starts, progress, ends };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlaytimeService join / heartbeat / leave", () => {
  it("credits playtime from tick deltas across heartbeats and the leave", async () => {
    const { service, starts, progress, ends } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(1000),
    });
    expect(starts[0]).toMatchObject({
      uuid: STEVE,
      playTimeTicks: ticks(1000),
    });
    service.setSessionId(STEVE, 42);

    vi.setSystemTime(new Date(T0.getTime() + seconds(60)));
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(1050) },
    ]);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({
      sessionId: 42,
      credit: {
        periodStart: T0,
        periodEnd: new Date(T0.getTime() + seconds(60)),
        seconds: 50,
        playTimeTicks: ticks(1050),
      },
    });

    vi.setSystemTime(new Date(T0.getTime() + seconds(120)));
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(1050) },
    ]);
    expect(progress[1].credit.seconds).toBe(0);
    expect(service.getSession(STEVE)?.lastSeenAt).toEqual(
      new Date(T0.getTime() + seconds(120)),
    );

    vi.setSystemTime(new Date(T0.getTime() + seconds(150)));
    await service.handlePlayerLeaveFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(1070),
    });

    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({
      sessionId: 42,
      secondsPlayed: 70,
      credit: { seconds: 20, playTimeTicks: ticks(1070) },
    });
    expect(service.isPlayerOnline(STEVE)).toBe(false);
  });

  it("falls back to wall-clock when the mod never reports ticks", async () => {
    const { service, progress, ends } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({ uuid: STEVE, username: "steve" });
    service.setSessionId(STEVE, 1);

    vi.setSystemTime(new Date(T0.getTime() + seconds(90)));
    service.reconcileWithHeartbeat([{ uuid: STEVE, username: "steve" }]);
    expect(progress[0].credit.seconds).toBe(90);

    vi.setSystemTime(new Date(T0.getTime() + seconds(100)));
    await service.handlePlayerLeaveFromMod({ uuid: STEVE, username: "steve" });
    expect(ends[0].secondsPlayed).toBe(100);
  });

  it("confirms presence but credits nothing until the session row exists", async () => {
    const { service, progress } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: 0,
    });

    const firstHeartbeat = new Date(T0.getTime() + seconds(60));
    vi.setSystemTime(firstHeartbeat);
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(60) },
    ]);
    expect(progress).toHaveLength(0);
    expect(service.getSession(STEVE)?.lastSeenAt).toEqual(firstHeartbeat);
    expect(service.getSession(STEVE)?.lastPlayTicks).toBe(0);

    service.setSessionId(STEVE, 7);
    vi.setSystemTime(new Date(T0.getTime() + seconds(120)));
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(120) },
    ]);
    expect(progress[0].credit).toEqual({
      periodStart: T0,
      periodEnd: new Date(T0.getTime() + seconds(120)),
      seconds: 120,
      playTimeTicks: ticks(120),
    });
  });

  it("closes at the session start when the mod reports a leave timestamp before it", async () => {
    const { service, ends } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      timestamp: T0,
      playTimeTicks: 0,
    });
    service.setSessionId(STEVE, 1);

    await service.handlePlayerLeaveFromMod({
      uuid: STEVE,
      username: "steve",
      timestamp: new Date(T0.getTime() - seconds(10)),
      playTimeTicks: ticks(5),
    });

    expect(ends[0]).toMatchObject({
      sessionId: 1,
      sessionEnd: T0,
      secondsPlayed: 5,
      credit: { periodStart: T0, periodEnd: T0, seconds: 5 },
    });
  });

  it("closes a session missing from the heartbeat at its last-seen instant with no extra credit", async () => {
    const { service, ends } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: 0,
    });
    service.setSessionId(STEVE, 1);

    const lastSeen = new Date(T0.getTime() + seconds(60));
    vi.setSystemTime(lastSeen);
    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(60) },
    ]);

    vi.setSystemTime(new Date(T0.getTime() + seconds(600)));
    service.reconcileWithHeartbeat([]);

    expect(ends[0]).toMatchObject({
      sessionId: 1,
      sessionEnd: lastSeen,
      secondsPlayed: 60,
      credit: { seconds: 0 },
    });
  });

  it("opens sessions for players the heartbeat lists but nothing tracks", () => {
    const { service, starts } = makeService();
    service.initialize();

    service.reconcileWithHeartbeat([
      { uuid: ALEX, username: "alex", playTimeTicks: ticks(5) },
    ]);

    expect(starts[0]).toMatchObject({
      uuid: ALEX,
      sessionStart: T0,
      playTimeTicks: ticks(5),
    });
    expect(service.getServerState()).toBe(ServerState.ONLINE);
  });

  it("emits an orphaned end for a leave with no tracked session", async () => {
    const { service, ends } = makeService();
    service.initialize();

    await service.handlePlayerLeaveFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(10),
    });

    expect(ends[0]).toMatchObject({
      sessionId: 0,
      uuid: STEVE,
      playTimeTicks: ticks(10),
      secondsPlayed: 0,
    });
    expect(ends[0].credit).toBeUndefined();
  });

  it("closes the stale session first when a tracked player joins again", async () => {
    const { service, starts, ends } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: 0,
    });
    service.setSessionId(STEVE, 1);

    vi.setSystemTime(new Date(T0.getTime() + seconds(300)));
    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: ticks(200),
    });

    expect(ends[0]).toMatchObject({ sessionId: 1, sessionEnd: T0 });
    expect(starts).toHaveLength(2);
    expect(service.getSession(STEVE)?.sessionId).toBeUndefined();
    expect(service.getSession(STEVE)?.lastPlayTicks).toBe(ticks(200));
  });
});

describe("PlaytimeService restart persistence", () => {
  it("restores open rows and credits the next heartbeat from the stored baseline", () => {
    const { service, starts, progress } = makeService();
    const sessionStart = new Date(T0.getTime() - seconds(3600));
    const lastSeenAt = new Date(T0.getTime() - seconds(600));

    service.hydrate([
      {
        id: 99,
        playerMinecraftUuid: STEVE,
        serverId: SERVER_ID,
        sessionStart,
        lastSeenAt,
        lastPlayTicks: ticks(5000),
        activeSeconds: 2400,
        minecraftUsername: "steve",
      },
      {
        id: 100,
        playerMinecraftUuid: ALEX,
        serverId: SERVER_ID,
        sessionStart,
        lastSeenAt: null,
        lastPlayTicks: null,
        activeSeconds: 0,
        minecraftUsername: "alex",
      },
    ]);
    service.initialize();

    expect(service.getOnlineCount()).toBe(2);
    expect(service.getSession(ALEX)?.lastSeenAt).toEqual(sessionStart);

    service.reconcileWithHeartbeat([
      { uuid: STEVE, username: "steve", playTimeTicks: ticks(5400) },
      { uuid: ALEX, username: "alex", playTimeTicks: ticks(10) },
    ]);

    expect(starts).toHaveLength(0);
    expect(progress.find((p) => p.uuid === STEVE)?.credit).toMatchObject({
      periodStart: lastSeenAt,
      periodEnd: T0,
      seconds: 400,
    });
    expect(progress.find((p) => p.uuid === ALEX)?.credit).toMatchObject({
      periodStart: sessionStart,
      seconds: 3600,
      playTimeTicks: ticks(10),
    });
    expect(service.getSession(STEVE)?.activeSeconds).toBe(2800);
  });

  it("leaves sessions open on stop", async () => {
    const { service, ends } = makeService();
    service.initialize();
    await service.handlePlayerJoinFromMod({ uuid: STEVE, username: "steve" });

    service.stop();

    expect(ends).toHaveLength(0);
    expect(service.getOnlineCount()).toBe(1);
  });
});

describe("PlaytimeService watchdog", () => {
  it("closes unconfirmed sessions after the stale window, honouring the boot grace period", async () => {
    const staleAfterMs = 5 * 60 * 1000;
    const { service, ends } = makeService({ staleAfterMs });
    const lastSeenAt = new Date(T0.getTime() - seconds(3600));

    service.hydrate([
      {
        id: 5,
        playerMinecraftUuid: STEVE,
        serverId: SERVER_ID,
        sessionStart: new Date(T0.getTime() - seconds(7200)),
        lastSeenAt,
        lastPlayTicks: ticks(100),
        activeSeconds: 10,
        minecraftUsername: "steve",
      },
    ]);
    service.initialize();

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(ends).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    expect(ends[0]).toMatchObject({
      sessionId: 5,
      sessionEnd: lastSeenAt,
      secondsPlayed: 10,
    });
    expect(service.getOnlineCount()).toBe(0);
  });

  it("marks the server offline when heartbeats stop", async () => {
    const staleAfterMs = 5 * 60 * 1000;
    const { service } = makeService({ staleAfterMs });
    service.initialize();

    service.reconcileWithHeartbeat([]);
    expect(service.getServerState()).toBe(ServerState.ONLINE);

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(service.getServerState()).toBe(ServerState.OFFLINE);
  });

  it("does not guess offline for a server that never sent a heartbeat", async () => {
    const staleAfterMs = 5 * 60 * 1000;
    const { service } = makeService({ staleAfterMs });
    service.initialize();
    await service.handlePlayerJoinFromMod({ uuid: STEVE, username: "steve" });

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(service.getServerState()).toBe(ServerState.ONLINE);
  });
});

describe("PlaytimeService relay shutdown", () => {
  it("ends every session now, crediting nothing for the unobserved tail of tick-tracked sessions", async () => {
    const { service, ends } = makeService();
    service.initialize();

    await service.handlePlayerJoinFromMod({
      uuid: STEVE,
      username: "steve",
      playTimeTicks: 0,
    });
    await service.handlePlayerJoinFromMod({ uuid: ALEX, username: "alex" });
    service.setSessionId(STEVE, 1);
    service.setSessionId(ALEX, 2);

    const now = new Date(T0.getTime() + seconds(30));
    vi.setSystemTime(now);
    service.handleServerShutdown();

    expect(ends).toHaveLength(2);
    expect(ends.find((e) => e.uuid === STEVE)).toMatchObject({
      sessionEnd: now,
      secondsPlayed: 0,
    });
    expect(ends.find((e) => e.uuid === ALEX)).toMatchObject({
      sessionEnd: now,
      secondsPlayed: 30,
    });
    expect(service.getServerState()).toBe(ServerState.OFFLINE);
  });
});
