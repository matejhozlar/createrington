import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q, playtimeRepo } from "@/db";

const STEVE = "aaaaaaaa-0000-4000-8000-000000000001";
const ALEX = "aaaaaaaa-0000-4000-8000-000000000002";
const STEVE_DISCORD = "777000000000000001";
const ALEX_DISCORD = "777000000000000002";
const SERVER_IDENTIFIER = "playtime-repo-test";

const T0 = new Date("2026-09-14T10:00:00Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const ticks = (seconds: number) => seconds * 20;

let serverId: number;

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: { $in: [STEVE, ALEX] } });
  await Q.player.deleteAll({
    discordId: { $in: [STEVE_DISCORD, ALEX_DISCORD] },
  });
}

async function resetPlayers(): Promise<void> {
  await removePlayers();
  await Q.player.playtime.summary.deleteAll({ serverId });
  await Q.player.create({
    minecraftUuid: STEVE,
    minecraftUsername: "steve",
    discordId: STEVE_DISCORD,
  });
  await Q.player.create({
    minecraftUuid: ALEX,
    minecraftUsername: "alex",
    discordId: ALEX_DISCORD,
  });
}

beforeAll(async () => {
  const existing = await Q.server.find({ identifier: SERVER_IDENTIFIER });
  serverId =
    existing?.id ??
    (
      await Q.server.createAndReturn({
        name: "Playtime repo test",
        identifier: SERVER_IDENTIFIER,
      })
    ).id;
});

beforeEach(async () => {
  await resetPlayers();
});

afterAll(async () => {
  await removePlayers();
  await Q.server.deleteAll({ id: serverId });
});

describe("PlaytimeRepository (integration)", () => {
  it("persists the tick baseline on start and exposes open sessions with usernames", async () => {
    const sessionId = await playtimeRepo.startSession({
      uuid: STEVE,
      username: "steve",
      serverId,
      sessionStart: T0,
      playTimeTicks: ticks(1000),
    });
    expect(sessionId).not.toBeNull();

    const row = await Q.player.session.get({ id: sessionId! });
    expect(row.startPlayTicks).toBe(ticks(1000));
    expect(row.lastPlayTicks).toBe(ticks(1000));
    expect(row.lastSeenAt).toEqual(T0);
    expect(row.activeSeconds).toBe(0n);

    const open = await playtimeRepo.getOpenSessions(serverId);
    expect(open).toEqual([
      expect.objectContaining({
        id: sessionId,
        playerMinecraftUuid: STEVE,
        minecraftUsername: "steve",
        lastSeenAt: T0,
        lastPlayTicks: ticks(1000),
        activeSeconds: 0,
      }),
    ]);

    const player = await Q.player.get({ minecraftUuid: STEVE });
    expect(player.online).toBe(true);
    expect(player.currentServerId).toBe(serverId);
  });

  it("credits heartbeat progress into the row and every aggregate, then closes with a final credit", async () => {
    const sessionId = (await playtimeRepo.startSession({
      uuid: STEVE,
      username: "steve",
      serverId,
      sessionStart: T0,
      playTimeTicks: ticks(1000),
    }))!;

    await playtimeRepo.progressSession({
      sessionId,
      uuid: STEVE,
      username: "steve",
      serverId,
      credit: {
        periodStart: T0,
        periodEnd: at(60),
        seconds: 45,
        playTimeTicks: ticks(1045),
      },
    });

    let row = await Q.player.session.get({ id: sessionId });
    expect(row.activeSeconds).toBe(45n);
    expect(row.lastPlayTicks).toBe(ticks(1045));
    expect(row.lastSeenAt).toEqual(at(60));
    expect(row.sessionEnd).toBeNull();

    let summary = await Q.player.playtime.summary.get({
      playerMinecraftUuid: STEVE,
      serverId,
    });
    expect(summary.totalSeconds).toBe(45n);
    expect(summary.totalSessions).toBe(0);

    await playtimeRepo.progressSession({
      sessionId,
      uuid: STEVE,
      username: "steve",
      serverId,
      credit: {
        periodStart: at(60),
        periodEnd: at(120),
        seconds: 0,
        playTimeTicks: ticks(1045),
      },
    });
    row = await Q.player.session.get({ id: sessionId });
    expect(row.activeSeconds).toBe(45n);
    expect(row.lastSeenAt).toEqual(at(120));

    await playtimeRepo.endSession({
      sessionId,
      uuid: STEVE,
      username: "steve",
      serverId,
      sessionStart: T0,
      sessionEnd: at(150),
      secondsPlayed: 65,
      credit: {
        periodStart: at(120),
        periodEnd: at(150),
        seconds: 20,
        playTimeTicks: ticks(1065),
      },
      playTimeTicks: ticks(1065),
    });

    row = await Q.player.session.get({ id: sessionId });
    expect(row.sessionEnd).toEqual(at(150));
    expect(row.activeSeconds).toBe(65n);
    expect(row.secondsPlayed).toBe(150n);

    summary = await Q.player.playtime.summary.get({
      playerMinecraftUuid: STEVE,
      serverId,
    });
    expect(summary.totalSeconds).toBe(65n);
    expect(summary.totalSessions).toBe(1);

    const daily = await Q.player.playtime.daily.findAll({
      playerMinecraftUuid: STEVE,
      serverId,
    });
    expect(daily.reduce((sum, d) => sum + d.secondsPlayed, 0n)).toBe(65n);

    const hourly = await Q.player.playtime.hourly.findAll({
      playerMinecraftUuid: STEVE,
      serverId,
    });
    expect(hourly.reduce((sum, h) => sum + h.secondsPlayed, 0n)).toBe(65n);

    const player = await Q.player.get({ minecraftUuid: STEVE });
    expect(player.online).toBe(false);
  });

  it("closes an orphaned session from its own last observation", async () => {
    const sessionId = (await playtimeRepo.startSession({
      uuid: STEVE,
      username: "steve",
      serverId,
      sessionStart: T0,
      playTimeTicks: ticks(1000),
    }))!;
    await playtimeRepo.progressSession({
      sessionId,
      uuid: STEVE,
      username: "steve",
      serverId,
      credit: {
        periodStart: T0,
        periodEnd: at(600),
        seconds: 600,
        playTimeTicks: ticks(1600),
      },
    });

    await playtimeRepo.endSession({
      sessionId: 0,
      uuid: STEVE,
      username: "steve",
      serverId,
      sessionStart: at(700),
      sessionEnd: at(700),
      secondsPlayed: 0,
      playTimeTicks: ticks(1640),
    });

    const row = await Q.player.session.get({ id: sessionId });
    expect(row.sessionEnd).toEqual(at(700));
    expect(row.activeSeconds).toBe(640n);
    expect(row.lastPlayTicks).toBe(ticks(1640));

    const summary = await Q.player.playtime.summary.get({
      playerMinecraftUuid: STEVE,
      serverId,
    });
    expect(summary.totalSeconds).toBe(640n);
    expect(summary.totalSessions).toBe(1);
  });

  it("closes a legacy row (no ticks, no last_seen_at) with wall-clock credit", async () => {
    const created = await Q.player.session.createAndReturn({
      playerMinecraftUuid: STEVE,
      serverId,
      sessionStart: T0,
    });

    await playtimeRepo.endSession({
      sessionId: 0,
      uuid: STEVE,
      username: "steve",
      serverId,
      sessionStart: at(300),
      sessionEnd: at(300),
      secondsPlayed: 0,
    });

    const row = await Q.player.session.get({ id: created.id });
    expect(row.sessionEnd).toEqual(at(300));
    expect(row.activeSeconds).toBe(300n);

    const summary = await Q.player.playtime.summary.get({
      playerMinecraftUuid: STEVE,
      serverId,
    });
    expect(summary.totalSeconds).toBe(300n);
  });

  describe("reconcileTotalsFromStats", () => {
    async function seedTotal(uuid: string, seconds: number): Promise<void> {
      await Q.player.playtime.summary.creditSeconds(
        uuid,
        serverId,
        seconds,
        T0,
        at(seconds),
      );
    }

    it("only reports in dry-run mode", async () => {
      await seedTotal(STEVE, 5000);

      const result = await playtimeRepo.reconcileTotalsFromStats(
        serverId,
        [{ minecraftUuid: STEVE, playTimeTicks: ticks(4800) }],
        { apply: false },
      );

      expect(result).toMatchObject({ checked: 1, drifted: 1, applied: 0 });
      const summary = await Q.player.playtime.summary.get({
        playerMinecraftUuid: STEVE,
        serverId,
      });
      expect(summary.totalSeconds).toBe(5000n);
    });

    it("overwrites drifted totals with the stat when applying", async () => {
      await seedTotal(STEVE, 5000);
      await seedTotal(ALEX, 100);

      const result = await playtimeRepo.reconcileTotalsFromStats(
        serverId,
        [
          { minecraftUuid: STEVE, playTimeTicks: ticks(4800) },
          { minecraftUuid: ALEX, playTimeTicks: ticks(100) },
        ],
        { apply: true },
      );

      expect(result).toMatchObject({ checked: 2, drifted: 1, applied: 1 });
      const steve = await Q.player.playtime.summary.get({
        playerMinecraftUuid: STEVE,
        serverId,
      });
      expect(steve.totalSeconds).toBe(4800n);
    });

    it("skips players with an open session and suspicious drops", async () => {
      await seedTotal(STEVE, 7200);
      await seedTotal(ALEX, 7200);
      await playtimeRepo.startSession({
        uuid: ALEX,
        username: "alex",
        serverId,
        sessionStart: T0,
      });

      const result = await playtimeRepo.reconcileTotalsFromStats(
        serverId,
        [
          { minecraftUuid: STEVE, playTimeTicks: ticks(10) },
          { minecraftUuid: ALEX, playTimeTicks: ticks(7000) },
        ],
        { apply: true },
      );

      expect(result).toMatchObject({
        checked: 2,
        applied: 0,
        skippedOpen: 1,
        skippedSuspicious: 1,
      });
      const steve = await Q.player.playtime.summary.get({
        playerMinecraftUuid: STEVE,
        serverId,
      });
      expect(steve.totalSeconds).toBe(7200n);
    });
  });
});
