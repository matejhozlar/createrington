import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  find: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  players: vi.fn(),
}));
const storage = vi.hoisted(() => ({
  enabled: true,
  put: vi.fn(),
  delete: vi.fn(),
  publicUrl: (key: string) => `https://assets.test/${key}`,
}));
const skinApi = vi.hoisted(() => ({ render: vi.fn() }));
const canvas = vi.hoisted(() => ({
  image: { width: 762, height: 1143 },
  toBuffer: vi.fn(() => Buffer.from("webp")),
  created: [] as Array<{ width: number; height: number }>,
}));

vi.mock("@/db", () => ({
  Q: {
    discord: {
      top: {
        role: {
          find: db.find,
          upsert: db.upsert,
          delete: db.delete,
          getAll: db.getAll,
        },
      },
    },
    player: { findAll: db.players },
  },
}));

vi.mock("@/services/storage", () => ({ objectStorage: storage }));

vi.mock("@/services/skin-api", () => ({
  getSkinApiClient: () => skinApi,
  MAX_QUALITY_RENDER: { width: 1366, height: 2048 },
  POSE_RENDER_STYLE: "cel",
}));

vi.mock("@napi-rs/canvas", () => ({
  loadImage: async () => canvas.image,
  createCanvas: (width: number, height: number) => {
    canvas.created.push({ width, height });
    return {
      getContext: () => ({ drawImage: vi.fn() }),
      toBuffer: canvas.toBuffer,
    };
  },
}));

vi.mock("@/services/discord/role/config", () => ({
  getTopRoleRules: () => [RECORDS_RULE, PLAYTIME_RULE],
}));

import {
  RoleCheckInterval,
  RoleConditionType,
} from "@/services/discord/role/types";
import type {
  TopPlaytimeRoleRule,
  TopStatRecordsRoleRule,
} from "@/services/discord/role/types";
import { TopRoleHolderService } from "@/services/discord/role/top-role-holder.service";

const RECORDS_RULE: TopStatRecordsRoleRule = {
  roleId: "role-records",
  gameRankId: "the_unrivaled",
  heroPose: "ninja",
  label: "The Unrivaled",
  checkInterval: RoleCheckInterval.DAILY,
  conditionType: RoleConditionType.TOP_STAT_RECORDS,
};

const PLAYTIME_RULE: TopPlaytimeRoleRule = {
  roleId: "role-playtime",
  gameRankId: "the_sleepless",
  heroPose: "zombie",
  label: "The Sleepless",
  checkInterval: RoleCheckInterval.DAILY,
  conditionType: RoleConditionType.TOP_PLAYTIME,
};

const ALICE = {
  discordId: "900000000000000101",
  minecraftUuid: "091b900c-4174-478c-900c-a0fe5a31a329",
  minecraftUsername: "alice",
  value: 41,
};

const BOB = {
  discordId: "900000000000000102",
  minecraftUuid: "80e97d7b-d98d-4261-b297-311758b62a1a",
  minecraftUsername: "bob",
  value: 12,
};

const HELD_SINCE = new Date("2026-09-01T00:00:00Z");

function existingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    roleKey: "the_unrivaled",
    discordId: ALICE.discordId,
    minecraftUuid: ALICE.minecraftUuid,
    value: "40.000",
    heldSince: HELD_SINCE,
    imageKey: "top-roles/the_unrivaled/alice-1.webp",
    updatedAt: HELD_SINCE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.enabled = true;
  canvas.image = { width: 762, height: 1143 };
  canvas.created.length = 0;
  skinApi.render.mockResolvedValue(new Uint8Array([1, 2, 3]));
  db.upsert.mockResolvedValue(undefined);
  db.delete.mockResolvedValue(undefined);
  storage.put.mockResolvedValue(undefined);
  storage.delete.mockResolvedValue(undefined);
});

describe("TopRoleHolderService.record", () => {
  it("renders the hero figure and starts a new tenure for a first holder", async () => {
    db.find.mockResolvedValue(null);
    const before = Date.now();

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).toHaveBeenCalledWith({
      pose: "ninja",
      source: { uuid: ALICE.minecraftUuid },
      options: { width: 1366, height: 2048, style: "cel" },
    });
    expect(storage.put).toHaveBeenCalledTimes(1);
    const stored = storage.put.mock.calls[0][0];
    expect(stored.key).toMatch(
      new RegExp(
        `^top-roles/the_unrivaled/${ALICE.minecraftUuid}-\\d+\\.webp$`,
      ),
    );
    expect(stored.contentType).toBe("image/webp");

    const [row, conflict] = db.upsert.mock.calls[0];
    expect(conflict).toBe("roleKey");
    expect(row).toMatchObject({
      roleKey: "the_unrivaled",
      discordId: ALICE.discordId,
      minecraftUuid: ALICE.minecraftUuid,
      value: "41.000",
      imageKey: stored.key,
    });
    expect(row.heldSince.getTime()).toBeGreaterThanOrEqual(before);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("keeps the tenure start and the existing figure for a returning holder", async () => {
    db.find.mockResolvedValue(existingRow());

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      heldSince: HELD_SINCE,
      imageKey: "top-roles/the_unrivaled/alice-1.webp",
      value: "41.000",
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("re-renders for the same holder when the previous render failed", async () => {
    db.find.mockResolvedValue(existingRow({ imageKey: null }));

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).toHaveBeenCalledTimes(1);
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      heldSince: HELD_SINCE,
      imageKey: expect.stringMatching(/^top-roles\/the_unrivaled\//),
    });
  });

  it("swaps the holder, resets the tenure and removes the old figure", async () => {
    db.find.mockResolvedValue(existingRow());

    await new TopRoleHolderService().record(RECORDS_RULE, BOB);

    const row = db.upsert.mock.calls[0][0];
    expect(row.discordId).toBe(BOB.discordId);
    expect(row.heldSince.getTime()).toBeGreaterThan(HELD_SINCE.getTime());
    expect(row.imageKey).toMatch(
      new RegExp(`^top-roles/the_unrivaled/${BOB.minecraftUuid}-`),
    );
    expect(storage.delete).toHaveBeenCalledWith([
      "top-roles/the_unrivaled/alice-1.webp",
    ]);
  });

  it("stores the holder without a figure when the render fails", async () => {
    db.find.mockResolvedValue(null);
    skinApi.render.mockRejectedValue(new Error("skin-api down"));

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(storage.put).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({ imageKey: null });
  });

  it("skips rendering entirely when object storage is not configured", async () => {
    storage.enabled = false;
    db.find.mockResolvedValue(null);

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({ imageKey: null });
  });

  it("downscales tall renders to the hero height but never upscales small crops", async () => {
    db.find.mockResolvedValue(null);
    const service = new TopRoleHolderService();

    canvas.image = { width: 1365, height: 2048 };
    await service.record(RECORDS_RULE, ALICE);
    expect(canvas.created[0]).toEqual({ width: 800, height: 1200 });

    canvas.image = { width: 581, height: 872 };
    await service.record(RECORDS_RULE, BOB);
    expect(canvas.created[1]).toEqual({ width: 581, height: 872 });
  });
});

describe("TopRoleHolderService.clear", () => {
  it("deletes the row and the stored figure", async () => {
    db.find.mockResolvedValue(existingRow());

    await new TopRoleHolderService().clear(RECORDS_RULE);

    expect(db.delete).toHaveBeenCalledWith({ roleKey: "the_unrivaled" });
    expect(storage.delete).toHaveBeenCalledWith([
      "top-roles/the_unrivaled/alice-1.webp",
    ]);
  });

  it("is a no-op when nobody holds the role", async () => {
    db.find.mockResolvedValue(null);

    await new TopRoleHolderService().clear(RECORDS_RULE);

    expect(db.delete).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe("TopRoleHolderService.list", () => {
  it("returns every configured role in order, with holders resolved to their current username", async () => {
    db.getAll.mockResolvedValue([existingRow()]);
    db.players.mockResolvedValue([
      { minecraftUuid: ALICE.minecraftUuid, minecraftUsername: "Alice_Now" },
    ]);

    const roles = await new TopRoleHolderService().list();

    expect(roles.map((role) => role.roleKey)).toEqual([
      "the_unrivaled",
      "the_sleepless",
    ]);
    expect(roles[0]).toMatchObject({
      label: "The Unrivaled",
      metric: "records",
      pose: "ninja",
      holder: {
        minecraftUsername: "Alice_Now",
        value: 40,
        heldSince: HELD_SINCE,
        imageUrl: "https://assets.test/top-roles/the_unrivaled/alice-1.webp",
      },
    });
    expect(roles[1]).toMatchObject({
      metric: "playtime",
      pose: "zombie",
      holder: null,
    });
  });

  it("reports a holder without a figure as an empty image url", async () => {
    db.getAll.mockResolvedValue([existingRow({ imageKey: null })]);
    db.players.mockResolvedValue([
      { minecraftUuid: ALICE.minecraftUuid, minecraftUsername: "alice" },
    ]);

    const [records] = await new TopRoleHolderService().list();

    expect(records.holder?.imageUrl).toBeNull();
  });
});
