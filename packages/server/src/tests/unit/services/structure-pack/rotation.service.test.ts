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
let cycleBoostClears: number;
let eligibleCalls: number;

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

vi.mock("@/config", () => ({
  default: { envMode: { isDev: false } },
}));

vi.mock("@/services/mc-server/file-ops", () => ({
  isFileOpsAllowed: () => false,
  copyFileToServer: async () => {},
  deleteFile: async () => {},
  fileExists: async () => false,
}));

vi.mock("@/services/curseforge", () => ({
  getModFileDownloadUrl: async () => null,
}));

vi.mock("@/db", () => {
  const makeTx = () => ({
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
          findAll: async () => openBoosts,
          delete: async ({ id }: { id: number }) => {
            boostDeletes.push(id);
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
          getEligibleForRotation: async () => {
            eligibleCalls += 1;
            return eligiblePacks;
          },
          rotation: {
            create: async (data: Record<string, unknown>) => {
              rotationCreates.push(data);
            },
            count: async () => rotationCreates.length,
            findAll: async () => [],
            config: {
              getOrCreateDefault: async () => rotationConfig,
            },
          },
          boost: {
            getBoostsByPackForCycle: async () => [],
            clearCycleBoosts: async () => {
              cycleBoostClears += 1;
            },
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

import { StructurePackRotationService } from "@/services/structure-pack/rotation";
import { BadRequestError } from "@/app/middleware/error-handler";
import type { StructurePackService } from "@/services/structure-pack";

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

function makeService() {
  const packService = {
    getActivePack: async () =>
      activePack ? { ...activePack, mods: [] } : null,
    getPack: async (id: number) => {
      const pack = packs.find((p) => p.id === id);
      if (!pack) throw new Error(`Pack ${id} not found`);
      return { ...pack, mods: [] };
    },
  } as unknown as StructurePackService;
  return new StructurePackRotationService(packService, null);
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
    } as StructurePackRotationConfig;
    packs = [];
    eligiblePacks = [];
    activePack = null;
    openBoosts = [];
    rotationCreates = [];
    packUpdates = [];
    boostDeletes = [];
    balanceAdds = [];
    balanceDeducts = 0;
    cycleBoostClears = 0;
    eligibleCalls = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(cycleBoostClears).toBe(1);

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
        cycleStart: new Date("2026-08-24T12:00:00Z"),
        createdAt: new Date("2026-08-25T00:00:00Z"),
      },
      {
        id: 11,
        discordId: "222",
        packId: 4,
        units: 1,
        currencySpent: 50,
        cycleStart: new Date("2026-08-24T12:00:00Z"),
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

  it("does not refund boosts on config updates that keep rotations enabled", async () => {
    openBoosts = [
      {
        id: 12,
        discordId: "111",
        packId: 3,
        units: 1,
        currencySpent: 50,
        cycleStart: new Date("2026-08-24T12:00:00Z"),
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
});
