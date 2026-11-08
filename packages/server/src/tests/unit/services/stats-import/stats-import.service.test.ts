import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

const { sftp, findAllPlayers, batchUpsert, reconcile, isEnabled } = vi.hoisted(
  () => ({
    sftp: {
      connect: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      end: vi.fn(),
    },
    findAllPlayers: vi.fn(),
    batchUpsert: vi.fn(),
    reconcile: vi.fn(),
    isEnabled: vi.fn(),
  }),
);

vi.mock("ssh2-sftp-client", () => ({
  default: vi.fn(function () {
    return sftp;
  }),
}));
vi.mock("@/db", () => ({
  Q: {
    player: {
      findAll: findAllPlayers,
      minecraft: { stats: { batchUpsert } },
    },
  },
  playtimeRepo: { reconcileTotalsFromStats: reconcile },
}));
vi.mock("@/services/feature-flag", () => ({
  FeatureFlags: { playtimeStatsReconcile: "playtime_stats_reconcile" },
  featureFlagService: { isEnabled },
}));

import { StatsImportService } from "@/services/stats-import/stats-import.service";
import type { PlaytimeManagerService } from "@/services/playtime/playtime-manager.service";
import type { StatsImportServerConfig } from "@/services/stats-import/config";

const STEVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STRANGER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SERVER_ID = 1;

const CONFIG: StatsImportServerConfig = {
  serverId: SERVER_ID,
  serverName: "Rails 'n Sails",
  sftp: {
    host: "mc.example",
    port: 22,
    username: "stats",
    password: "secret",
    statsPath: "/world/stats",
  },
};

function file(name: string, type = "-") {
  return { name, type };
}

function statsFile(playTime: unknown, wrapped = true) {
  const stats = { "minecraft:custom": { "minecraft:play_time": playTime } };
  return JSON.stringify(wrapped ? { stats, DataVersion: 3955 } : stats);
}

let playtimeService: EventEmitter;
let service: StatsImportService;

function createService(withPlaytime = true): StatsImportService {
  const manager = {
    getService: () => (withPlaytime ? playtimeService : undefined),
  } as unknown as PlaytimeManagerService;
  return new StatsImportService(manager, [CONFIG]);
}

async function runInitialImport(): Promise<void> {
  service.initialize();
  await vi.waitFor(() => expect(sftp.end).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  playtimeService = new EventEmitter();
  service = createService();
  sftp.connect.mockResolvedValue(undefined);
  sftp.end.mockResolvedValue(undefined);
  sftp.list.mockResolvedValue([
    file(`${STEVE}.json`),
    file(`${ALEX}.json`),
    file(`${STRANGER}.json`),
    file("not-a-uuid.json"),
    file("notes.txt"),
    file("archive.json", "d"),
  ]);
  sftp.get.mockImplementation((path: string) =>
    Promise.resolve(
      Buffer.from(
        path.endsWith(`${ALEX}.json`)
          ? statsFile(500, false)
          : statsFile(72_000),
      ),
    ),
  );
  findAllPlayers.mockResolvedValue([
    { minecraftUuid: STEVE },
    { minecraftUuid: ALEX },
  ]);
  batchUpsert.mockResolvedValue(undefined);
  reconcile.mockResolvedValue({
    checked: 2,
    drifted: 0,
    applied: 0,
    skippedOpen: 0,
    skippedSuspicious: 0,
  });
  isEnabled.mockResolvedValue(false);
});

afterEach(() => {
  service.shutdown();
  vi.useRealTimers();
});

describe("StatsImportService import", () => {
  it("connects with the server's SFTP credentials and reads its stats directory", async () => {
    await runInitialImport();

    expect(sftp.connect).toHaveBeenCalledWith({
      host: "mc.example",
      port: 22,
      username: "stats",
      password: "secret",
    });
    expect(sftp.list).toHaveBeenCalledWith("/world/stats");
  });

  it("imports registered players only, looking them up in one query", async () => {
    await runInitialImport();

    expect(findAllPlayers).toHaveBeenCalledWith(
      { minecraftUuid: { $in: [STEVE, ALEX, STRANGER] } },
      { select: ["minecraftUuid"] },
    );
    expect(sftp.get).toHaveBeenCalledTimes(2);
    expect(batchUpsert).toHaveBeenCalledWith(SERVER_ID, [
      {
        minecraftUuid: STEVE,
        stats: { "minecraft:custom": { "minecraft:play_time": 72_000 } },
        dataVersion: 3955,
      },
      {
        minecraftUuid: ALEX,
        stats: { "minecraft:custom": { "minecraft:play_time": 500 } },
        dataVersion: null,
      },
    ]);
  });

  it("skips a file it cannot parse and imports the rest", async () => {
    sftp.get.mockImplementation((path: string) =>
      Promise.resolve(
        Buffer.from(
          path.endsWith(`${STEVE}.json`) ? "{ broken" : statsFile(500),
        ),
      ),
    );

    await runInitialImport();

    expect(batchUpsert).toHaveBeenCalledWith(SERVER_ID, [
      expect.objectContaining({ minecraftUuid: ALEX }),
    ]);
  });

  it("writes nothing when no stats file belongs to a registered player", async () => {
    findAllPlayers.mockResolvedValue([]);

    await runInitialImport();

    expect(batchUpsert).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("disconnects and recovers after an SFTP failure", async () => {
    sftp.connect.mockRejectedValueOnce(new Error("connection refused"));

    await runInitialImport();
    expect(batchUpsert).not.toHaveBeenCalled();

    vi.useFakeTimers();
    playtimeService.emit("sessionEnd");
    await vi.advanceTimersByTimeAsync(30_000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(batchUpsert).toHaveBeenCalledTimes(1));
  });
});

describe("StatsImportService playtime reconcile", () => {
  it("only reports drift while the reconcile flag is off", async () => {
    await runInitialImport();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalled());

    expect(isEnabled).toHaveBeenCalledWith("playtime_stats_reconcile");
    expect(reconcile).toHaveBeenCalledWith(
      SERVER_ID,
      [
        { minecraftUuid: STEVE, playTimeTicks: 72_000 },
        { minecraftUuid: ALEX, playTimeTicks: 500 },
      ],
      { apply: false },
    );
  });

  it("applies the vanilla play time when the flag is on", async () => {
    isEnabled.mockResolvedValue(true);

    await runInitialImport();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalled());

    expect(reconcile).toHaveBeenCalledWith(SERVER_ID, expect.any(Array), {
      apply: true,
    });
  });

  it.each([
    ["a negative", -1],
    ["a fractional", 12.5],
    ["a non-numeric", "72000"],
  ])(
    "leaves out %s play time but still imports the stats",
    async (_label, playTime) => {
      sftp.get.mockResolvedValue(Buffer.from(statsFile(playTime)));

      await runInitialImport();

      expect(batchUpsert).toHaveBeenCalled();
      expect(reconcile).not.toHaveBeenCalled();
    },
  );
});

describe("StatsImportService scheduling", () => {
  beforeEach(async () => {
    await runInitialImport();
    vi.clearAllMocks();
    sftp.end.mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  it("collapses a burst of session events into one import 30 seconds after the last", async () => {
    playtimeService.emit("sessionStart");
    await vi.advanceTimersByTimeAsync(20_000);
    playtimeService.emit("sessionEnd");
    playtimeService.emit("sessionStart");
    await vi.advanceTimersByTimeAsync(29_999);
    expect(sftp.connect).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(sftp.connect).toHaveBeenCalledTimes(1);
  });

  it("drops a pending import on shutdown", async () => {
    playtimeService.emit("sessionEnd");
    service.shutdown();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(sftp.connect).not.toHaveBeenCalled();
  });

  it("does not start a second import for a server while one is running", async () => {
    let releaseList!: () => void;
    sftp.list.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseList = () => resolve([]);
      }),
    );

    playtimeService.emit("sessionEnd");
    await vi.advanceTimersByTimeAsync(30_000);
    playtimeService.emit("sessionEnd");
    await vi.advanceTimersByTimeAsync(30_000);
    releaseList();
    await vi.advanceTimersByTimeAsync(0);

    expect(sftp.connect).toHaveBeenCalledTimes(1);
  });
});

it("still runs the initial import for a server with no playtime service", async () => {
  service = createService(false);

  await runInitialImport();

  expect(batchUpsert).toHaveBeenCalled();
});
