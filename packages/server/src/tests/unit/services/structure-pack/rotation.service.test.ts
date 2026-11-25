import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  StructurePack,
  StructurePackBoost,
  StructurePackRotationConfig,
} from "@createrington/shared/db";

let rotationConfig: StructurePackRotationConfig;
let packs: StructurePack[];
let eligiblePacks: StructurePack[];
let activePack: StructurePack | null;
let openBoosts: StructurePackBoost[];
let rotationCreates: Array<Record<string, unknown>>;
let packUpdates: Array<{ where: unknown; data: unknown }>;
let boostDeletes: number[];
let balanceAdds: Array<{
  identifier: unknown;
  amount: number;
  type: string;
}>;
let balanceDeducts: number;
let lastRotations: Array<{ rotatedAt: Date }>;
let eligibleCalls: number;
let deletedBuyers: Set<string>;
let fileOpsAllowed: boolean;
let serverFiles: Set<string>;
let failingCopy: string | null;
let failingDelete: string | null;
let packMods: Map<number, string[]>;

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

vi.mock("@/config", () => ({
  default: { envMode: { isDev: false } },
}));

vi.mock("@/services/mc-server/file-ops", () => ({
  isFileOpsAllowed: () => fileOpsAllowed,
  copyFileToServer: async (_source: string, target: string) => {
    serverFiles.add(target);
    if (target === failingCopy) throw new Error("SFTP connection lost");
  },
  deleteFile: async (target: string) => {
    if (target === failingDelete) {
      failingDelete = null;
      throw new Error("SFTP connection lost");
    }
    serverFiles.delete(target);
  },
  fileExists: async (target: string) => serverFiles.has(target),
}));

vi.mock("@/services/structure-pack/rotation/mod-cache", () => ({
  ensureModsCached: async () => {},
  getCachePath: (fileName: string) => `cache/${fileName}`,
}));

vi.mock("@/services/curseforge/downloads", () => ({
  getModFileDownloadUrl: async () => null,
}));

vi.mock("@/db", () => {
  const makeTx = () => ({
    player: {
      findAll: async ({ discordId }: { discordId: { $in: string[] } }) =>
        discordId.$in
          .filter((id) => !deletedBuyers.has(id))
          .map((id) => ({ discordId: id })),
    },
    structure: {
      pack: {
        update: async (where: unknown, data: unknown) => {
          packUpdates.push({ where, data });
        },
        rotation: {
          config: {
            updateAndReturn: async (
              _where: unknown,
              data: Partial<StructurePackRotationConfig>,
            ) => {
              rotationConfig = { ...rotationConfig, ...data };
              return rotationConfig;
            },
          },
        },
        boost: {
          findAll: async () => [...openBoosts],
          deleteAll: async ({ id }: { id: { $in: number[] } }) => {
            boostDeletes.push(...id.$in);
            return id.$in.length;
          },
        },
      },
    },
  });

  return {
    Q: {
      structure: {
        pack: {
          find: async ({ id }: { id: number }) =>
            packs.find((p) => p.id === id) ?? null,
          update: async (where: unknown, data: unknown) => {
            packUpdates.push({ where, data });
          },
          getEligibleForRotation: async () => {
            eligibleCalls += 1;
            return eligiblePacks;
          },
          rotation: {
            create: async (data: Record<string, unknown>) => {
              rotationCreates.push(data);
            },
            count: async () => rotationCreates.length,
            findAll: async () => lastRotations,
            config: {
              getOrCreateDefault: async () => rotationConfig,
            },
          },
          boost: {
            findAll: async (filter: { discordId?: string } = {}) =>
              openBoosts.filter(
                (boost) =>
                  !filter.discordId || boost.discordId === filter.discordId,
              ),
          },
        },
      },
    },
    db: {
      inTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(makeTx()),
    },
    balanceRepo: {
      add: async (
        identifier: unknown,
        amount: number,
        _reason: string,
        type: string,
      ) => {
        balanceAdds.push({ identifier, amount, type });
        return amount;
      },
      deduct: async () => {
        balanceDeducts += 1;
        return 0;
      },
    },
  };
});

import { StructurePackRotationService } from "@/services/structure-pack/rotation/rotation.service";
import { BadRequestError } from "@/errors";
import type { StructurePackService } from "@/services/structure-pack/structure-pack.service";

function makePack(id: number, overrides: Partial<StructurePack> = {}) {
  return {
    id,
    name: `Pack ${id}`,
    description: null,
    enabled: true,
    isActive: false,
    lastActivatedAt: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as StructurePack;
}

function modsOf(packId: number) {
  return (packMods.get(packId) ?? []).map((fileName) => ({ fileName }));
}

function makeService() {
  const packService = {
    getActivePack: async () =>
      activePack ? { ...activePack, mods: modsOf(activePack.id) } : null,
    getPack: async (id: number) => {
      const pack = packs.find((p) => p.id === id);
      if (!pack) throw new Error(`Pack ${id} not found`);
      return { ...pack, mods: modsOf(id) };
    },
  } as unknown as StructurePackService;
  return new StructurePackRotationService(packService);
}

describe("StructurePackRotationService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T10:00:00Z"));
    rotationConfig = {
      id: 1,
      enabled: true,
      period: "weekly",
      dayOfWeek: 1,
      dayOfMonth: 1,
      time: "12:00",
      timezone: "UTC",
      boostUnitPrice: 50,
      timeWeightMultiplier: 1,
      boostWeightPerUnit: 1,
      gracePeriodMinutes: 30,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    packs = [];
    eligiblePacks = [];
    activePack = null;
    openBoosts = [];
    rotationCreates = [];
    packUpdates = [];
    boostDeletes = [];
    balanceAdds = [];
    balanceDeducts = 0;
    lastRotations = [];
    eligibleCalls = 0;
    deletedBuyers = new Set();
    fileOpsAllowed = false;
    serverFiles = new Set();
    failingCopy = null;
    failingDelete = null;
    packMods = new Map();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("skips automatic rotation while disabled and schedules nothing", async () => {
    rotationConfig.enabled = false;
    const service = makeService();

    await service.executeRotation();

    expect(rotationCreates).toHaveLength(0);
    expect(packUpdates).toHaveLength(0);
    expect(eligibleCalls).toBe(0);

    await vi.advanceTimersByTimeAsync(EIGHT_DAYS_MS);
    expect(eligibleCalls).toBe(0);
  });

  it("still runs a manual rotation while disabled", async () => {
    rotationConfig.enabled = false;
    packs = [makePack(1, { isActive: true }), makePack(2)];
    activePack = packs[0];
    eligiblePacks = [packs[1]];
    const service = makeService();

    await service.executeRotation(true);

    expect(rotationCreates).toHaveLength(1);
    expect(rotationCreates[0]).toMatchObject({
      outgoingPackId: 1,
      incomingPackId: 2,
      success: true,
    });
    expect(boostDeletes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(EIGHT_DAYS_MS);
    expect(eligibleCalls).toBe(1);
  });

  it("records no history row when no packs are eligible and reschedules", async () => {
    eligiblePacks = [];
    const service = makeService();

    await service.executeRotation();

    expect(rotationCreates).toHaveLength(0);
    expect(eligibleCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(EIGHT_DAYS_MS);
    expect(eligibleCalls).toBeGreaterThanOrEqual(2);
    expect(rotationCreates).toHaveLength(0);
    service.shutdown();
  });

  it("throws to the manual caller when no packs are eligible", async () => {
    eligiblePacks = [];
    const service = makeService();

    await expect(service.executeRotation(true)).rejects.toThrow(
      BadRequestError,
    );
    await expect(service.executeRotation(true)).rejects.toThrow(
      "No eligible packs for rotation",
    );
    expect(rotationCreates).toHaveLength(0);
  });

  it("rejects boost purchases while disabled", async () => {
    rotationConfig.enabled = false;
    packs = [makePack(3)];
    const service = makeService();

    await expect(service.purchaseBoost("123", 3, 1)).rejects.toThrow(
      "Rotations are currently disabled",
    );
    expect(balanceDeducts).toBe(0);
  });

  it("refunds and removes open boosts when rotations are disabled", async () => {
    openBoosts = [
      {
        id: 10,
        discordId: "111",
        packId: 3,
        units: 2,
        currencySpent: 100,
        createdAt: new Date("2026-08-25T00:00:00Z"),
      },
      {
        id: 11,
        discordId: "222",
        packId: 4,
        units: 1,
        currencySpent: 50,
        createdAt: new Date("2026-08-25T00:00:00Z"),
      },
    ] as StructurePackBoost[];
    const service = makeService();

    const updated = await service.updateConfig({ enabled: false });

    expect(updated.enabled).toBe(false);
    expect(balanceAdds).toEqual([
      { identifier: { discordId: "111" }, amount: 100, type: "refund" },
      { identifier: { discordId: "222" }, amount: 50, type: "refund" },
    ]);
    expect(boostDeletes).toEqual([10, 11]);

    await vi.advanceTimersByTimeAsync(EIGHT_DAYS_MS);
    expect(eligibleCalls).toBe(0);
  });

  it("disables rotations when an open boost belongs to a deleted player, dropping that boost", async () => {
    openBoosts = [makeBoost(12, 3, 2, "111"), makeBoost(13, 4, 1, "gone")];
    deletedBuyers = new Set(["gone"]);
    const service = makeService();

    const updated = await service.updateConfig({ enabled: false });

    expect(updated.enabled).toBe(false);
    expect(balanceAdds).toEqual([
      { identifier: { discordId: "111" }, amount: 100, type: "refund" },
    ]);
    expect(boostDeletes).toEqual([12, 13]);
  });

  it("does not refund boosts on config updates that keep rotations enabled", async () => {
    openBoosts = [
      {
        id: 12,
        discordId: "111",
        packId: 3,
        units: 1,
        currencySpent: 50,
        createdAt: new Date("2026-08-25T00:00:00Z"),
      },
    ] as StructurePackBoost[];
    const service = makeService();

    await service.updateConfig({ boostUnitPrice: 75 });

    expect(balanceAdds).toHaveLength(0);
    expect(boostDeletes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(EIGHT_DAYS_MS);
    expect(eligibleCalls).toBeGreaterThanOrEqual(1);
    service.shutdown();
  });

  function makeBoost(
    id: number,
    packId: number,
    units: number,
    discordId = "111",
  ) {
    return {
      id,
      discordId,
      packId,
      units,
      currencySpent: units * 50,
      createdAt: new Date("2026-08-25T00:00:00Z"),
    } as StructurePackBoost;
  }

  function boostFactors() {
    const snapshot = rotationCreates[0]?.weightsSnapshot as Array<{
      packId: number;
      boostFactor: number;
    }>;
    return Object.fromEntries(
      snapshot.map((entry) => [entry.packId, entry.boostFactor]),
    );
  }

  it("counts and deletes the ending cycle's boosts when the scheduled rotation fires at the boundary", async () => {
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    openBoosts = [makeBoost(20, 3, 5), makeBoost(21, 3, 2)];
    const service = makeService();

    await service.initialize();
    expect(rotationCreates).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(
      new Date("2026-08-31T12:00:00Z").getTime() - Date.now(),
    );

    expect(rotationCreates).toHaveLength(1);
    expect(boostFactors()).toEqual({ 3: 7, 4: 0 });
    expect(boostDeletes).toEqual([20, 21]);
    service.shutdown();
  });

  it("schedules in UTC when the stored timezone is not a valid zone", async () => {
    rotationConfig.timezone = "Europe/Pargue";
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    const service = makeService();

    await service.initialize();
    await vi.advanceTimersByTimeAsync(
      new Date("2026-08-31T12:00:00Z").getTime() - Date.now(),
    );

    expect(rotationCreates).toHaveLength(1);
    expect((await service.getConfig()).timezone).toBe("UTC");
    service.shutdown();
  });

  it("counts open boosts in a missed rotation that runs at boot, after the boundary", async () => {
    vi.setSystemTime(new Date("2026-09-01T08:00:00Z"));
    lastRotations = [{ rotatedAt: new Date("2026-08-17T12:00:00Z") }];
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    openBoosts = [makeBoost(30, 4, 3)];
    const service = makeService();

    await service.initialize();

    expect(rotationCreates).toHaveLength(1);
    expect(boostFactors()).toEqual({ 3: 0, 4: 3 });
    expect(boostDeletes).toEqual([30]);
    service.shutdown();
  });

  it("rotates at boot when a restart straddled the scheduled time", async () => {
    vi.setSystemTime(new Date("2026-08-31T12:10:00Z"));
    lastRotations = [{ rotatedAt: new Date("2026-08-24T12:00:03Z") }];
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    const service = makeService();

    await service.initialize();

    expect(rotationCreates).toHaveLength(1);
    service.shutdown();
  });

  it("rotates at boot when a manual rotation was followed by downtime across the scheduled time", async () => {
    vi.setSystemTime(new Date("2026-08-31T12:10:00Z"));
    lastRotations = [{ rotatedAt: new Date("2026-08-28T09:00:00Z") }];
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    const service = makeService();

    await service.initialize();

    expect(rotationCreates).toHaveLength(1);
    service.shutdown();
  });

  it("does not rotate at boot when the last rotation was stamped moments before its scheduled time", async () => {
    lastRotations = [{ rotatedAt: new Date("2026-08-24T11:59:58Z") }];
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    const service = makeService();

    await service.initialize();

    expect(rotationCreates).toHaveLength(0);
    service.shutdown();
  });

  it("does not report a monthly rotation as missed late in a 31-day month", async () => {
    vi.setSystemTime(new Date("2026-08-31T18:00:00Z"));
    rotationConfig.period = "monthly";
    rotationConfig.dayOfMonth = 1;
    lastRotations = [{ rotatedAt: new Date("2026-08-01T12:00:04Z") }];
    packs = [makePack(3)];
    eligiblePacks = packs;
    const service = makeService();

    await service.initialize();

    expect(rotationCreates).toHaveLength(0);
    service.shutdown();
  });

  it("keeps the outgoing pack's files when installing the incoming pack fails", async () => {
    fileOpsAllowed = true;
    activePack = makePack(1, { isActive: true });
    packs = [activePack, makePack(3)];
    eligiblePacks = [packs[1]];
    packMods = new Map([
      [1, ["old.jar", "shared.jar"]],
      [3, ["shared.jar", "new-a.jar", "new-b.jar"]],
    ]);
    serverFiles = new Set(["mods/old.jar", "mods/shared.jar"]);
    failingCopy = "mods/new-b.jar";
    const service = makeService();

    await service.executeRotation();

    expect([...serverFiles].sort()).toEqual([
      "mods/old.jar",
      "mods/shared.jar",
    ]);
    expect(rotationCreates).toMatchObject([
      { incomingPackId: 3, success: false },
    ]);
    expect(packUpdates).toHaveLength(0);
    service.shutdown();
  });

  it("leaves the mods as they were when removing the outgoing pack fails", async () => {
    fileOpsAllowed = true;
    activePack = makePack(1, { isActive: true });
    packs = [activePack, makePack(3)];
    eligiblePacks = [packs[1]];
    packMods = new Map([
      [1, ["old-a.jar", "old-b.jar", "shared.jar"]],
      [3, ["shared.jar", "new-a.jar"]],
    ]);
    serverFiles = new Set([
      "mods/old-a.jar",
      "mods/old-b.jar",
      "mods/shared.jar",
    ]);
    failingDelete = "mods/old-b.jar";
    const service = makeService();

    await service.executeRotation();

    expect([...serverFiles].sort()).toEqual([
      "mods/old-a.jar",
      "mods/old-b.jar",
      "mods/shared.jar",
    ]);
    expect(rotationCreates).toMatchObject([
      { incomingPackId: 3, success: false },
    ]);
    expect(packUpdates).toHaveLength(0);
    service.shutdown();
  });

  it("installs the incoming pack before removing the outgoing one", async () => {
    fileOpsAllowed = true;
    activePack = makePack(1, { isActive: true });
    packs = [activePack, makePack(3)];
    eligiblePacks = [packs[1]];
    packMods = new Map([
      [1, ["old.jar", "shared.jar"]],
      [3, ["shared.jar", "new-a.jar"]],
    ]);
    serverFiles = new Set(["mods/old.jar", "mods/shared.jar"]);
    const service = makeService();

    await service.executeRotation();

    expect([...serverFiles].sort()).toEqual([
      "mods/new-a.jar",
      "mods/shared.jar",
    ]);
    expect(rotationCreates).toMatchObject([
      { incomingPackId: 3, success: true },
    ]);
    service.shutdown();
  });

  function buyDuringDraw(
    service: StructurePackRotationService,
    boost: StructurePackBoost,
  ) {
    const packService = (
      service as unknown as {
        packService: { getPack: (id: number) => Promise<unknown> };
      }
    ).packService;
    const getPack = packService.getPack;
    packService.getPack = async (id) => {
      openBoosts.push(boost);
      return getPack(id);
    };
  }

  it("keeps a boost bought during the draw for another eligible pack open for the next one", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    openBoosts = [makeBoost(40, 3, 1)];
    const service = makeService();
    buyDuringDraw(service, makeBoost(41, 4, 1));

    await service.executeRotation(true);

    expect(rotationCreates[0]).toMatchObject({ incomingPackId: 3 });
    expect(boostDeletes).toEqual([40]);
    expect(balanceAdds).toHaveLength(0);
    service.shutdown();
  });

  it("refunds a boost bought during the draw for the pack that wins it", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    packs = [makePack(3), makePack(4)];
    eligiblePacks = packs;
    openBoosts = [makeBoost(42, 3, 1)];
    const service = makeService();
    buyDuringDraw(service, makeBoost(43, 3, 2));

    await service.executeRotation(true);

    expect(rotationCreates[0]).toMatchObject({ incomingPackId: 3 });
    expect(boostDeletes.sort()).toEqual([42, 43]);
    expect(balanceAdds).toEqual([
      { identifier: { discordId: "111" }, amount: 100, type: "refund" },
    ]);
    service.shutdown();
  });

  it("refunds boosts on a pack that is not in the draw", async () => {
    packs = [makePack(3), makePack(9, { enabled: false })];
    eligiblePacks = [packs[0]];
    openBoosts = [makeBoost(44, 3, 1), makeBoost(45, 9, 3)];
    const service = makeService();

    await service.executeRotation(true);

    expect(boostFactors()).toEqual({ 3: 1 });
    expect(boostDeletes.sort()).toEqual([44, 45]);
    expect(balanceAdds).toEqual([
      { identifier: { discordId: "111" }, amount: 150, type: "refund" },
    ]);
    service.shutdown();
  });

  it("keeps open boosts when an admin clears the rotation", async () => {
    packs = [makePack(1, { isActive: true }), makePack(3)];
    activePack = packs[0];
    openBoosts = [makeBoost(50, 3, 2)];
    const service = makeService();

    await service.clearRotation();

    expect(packUpdates).toEqual([
      { where: { id: 1 }, data: { isActive: false } },
    ]);
    expect(boostDeletes).toHaveLength(0);
  });

  it("waits for a monthly rotation 30 days out instead of firing at once", async () => {
    vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
    rotationConfig.period = "monthly";
    rotationConfig.dayOfMonth = 1;
    packs = [makePack(3)];
    eligiblePacks = packs;
    const service = makeService();

    await service.initialize();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(eligibleCalls).toBe(0);

    await vi.advanceTimersByTimeAsync(
      new Date("2026-09-01T12:00:00Z").getTime() - Date.now(),
    );
    expect(rotationCreates).toHaveLength(1);
    expect(eligibleCalls).toBe(1);
    service.shutdown();
  });
});
