import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function fakeImage(
  width: number,
  height: number,
  box: { x: number; y: number; width: number; height: number },
): FakeImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { width, height, data };
}

const PLAIN = fakeImage(10, 16, { x: 2, y: 4, width: 6, height: 10 });
const OUTLINED = fakeImage(14, 20, { x: 2, y: 6, width: 10, height: 14 });
const MISALIGNED = fakeImage(14, 20, { x: 0, y: 0, width: 13, height: 20 });

const db = vi.hoisted(() => ({
  find: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  players: vi.fn(),
  reignFindOpen: vi.fn(),
  reignUpdate: vi.fn(),
  reignCreate: vi.fn(),
  reignUpdateAll: vi.fn(),
}));
const storage = vi.hoisted(() => ({
  enabled: true,
  put: vi.fn(),
  delete: vi.fn(),
  publicUrl: (key: string) => `https://assets.test/${key}`,
}));
const skinApi = vi.hoisted(() => ({ render: vi.fn() }));
const canvas = vi.hoisted(() => ({
  plain: null as unknown as FakeImage,
  outlined: null as unknown as FakeImage,
  toBuffer: vi.fn(() => Buffer.from("webp")),
  created: [] as Array<{
    width: number;
    height: number;
    draws: Array<{ image: FakeImage; args: number[] }>;
  }>,
}));

vi.mock("@/db", () => ({
  db: {
    inTransaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        discord: {
          top: {
            role: {
              upsert: db.upsert,
              delete: db.delete,
              reign: {
                findOpen: db.reignFindOpen,
                update: db.reignUpdate,
                create: db.reignCreate,
                updateAll: db.reignUpdateAll,
              },
            },
          },
        },
      }),
  },
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
  loadImage: async (buffer: Buffer) =>
    buffer[0] === 2 ? canvas.outlined : canvas.plain,
  createCanvas: (width: number, height: number) => {
    const entry = {
      width,
      height,
      draws: [] as Array<{ image: FakeImage; args: number[] }>,
    };
    canvas.created.push(entry);
    return {
      getContext: () => ({
        drawImage: (image: FakeImage, ...args: number[]) =>
          entry.draws.push({ image, args }),
        getImageData: () => entry.draws[0].image,
      }),
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
const ALICE_IMAGE = "top-roles/the_unrivaled/alice-1.webp";
const ALICE_OUTLINE = "top-roles/the_unrivaled/alice-1-outline.webp";

function existingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    roleKey: "the_unrivaled",
    discordId: ALICE.discordId,
    minecraftUuid: ALICE.minecraftUuid,
    value: "40.000",
    heldSince: HELD_SINCE,
    imageKey: ALICE_IMAGE,
    outlineImageKey: ALICE_OUTLINE,
    updatedAt: HELD_SINCE,
    ...overrides,
  };
}

function openReign(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 7,
    roleKey: "the_unrivaled",
    discordId: ALICE.discordId,
    minecraftUuid: ALICE.minecraftUuid,
    startedAt: HELD_SINCE,
    endedAt: null,
    startValue: "30.000",
    lastValue: "40.000",
    ...overrides,
  };
}

function storedKeys(): string[] {
  return storage.put.mock.calls.map(([object]) => object.key);
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.enabled = true;
  canvas.plain = PLAIN;
  canvas.outlined = OUTLINED;
  canvas.created.length = 0;
  skinApi.render.mockImplementation(
    async ({ options }: { options: { outline?: boolean } }) =>
      new Uint8Array([options.outline ? 2 : 1]),
  );
  db.upsert.mockResolvedValue(undefined);
  db.delete.mockResolvedValue(undefined);
  db.reignFindOpen.mockResolvedValue(null);
  storage.put.mockResolvedValue(undefined);
  storage.delete.mockResolvedValue(undefined);
});

describe("TopRoleHolderService.record", () => {
  it("renders the plain and outlined figures and starts a new tenure for a first holder", async () => {
    db.find.mockResolvedValue(null);
    const before = Date.now();

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).toHaveBeenCalledWith({
      pose: "ninja",
      source: { uuid: ALICE.minecraftUuid },
      options: { width: 1366, height: 2048, style: "cel" },
    });
    expect(skinApi.render).toHaveBeenCalledWith({
      pose: "ninja",
      source: { uuid: ALICE.minecraftUuid },
      options: { width: 1366, height: 2048, style: "cel", outline: true },
    });
    const outlineImageKey = storedKeys().find((key) =>
      key.endsWith("-outline.webp"),
    );
    const imageKey = storedKeys().find((key) => key !== outlineImageKey) ?? "";
    expect(imageKey).toMatch(
      new RegExp(
        `^top-roles/the_unrivaled/${ALICE.minecraftUuid}-\\d+\\.webp$`,
      ),
    );
    expect(outlineImageKey).toBe(imageKey.replace(/\.webp$/, "-outline.webp"));
    expect(storage.put.mock.calls[0][0].contentType).toBe("image/webp");

    const [row, conflict] = db.upsert.mock.calls[0];
    expect(conflict).toBe("roleKey");
    expect(row).toMatchObject({
      roleKey: "the_unrivaled",
      discordId: ALICE.discordId,
      minecraftUuid: ALICE.minecraftUuid,
      value: "41.000",
      imageKey,
      outlineImageKey,
    });
    expect(row.heldSince.getTime()).toBeGreaterThanOrEqual(before);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("frames the plain figure on the outlined canvas so the two line up", async () => {
    db.find.mockResolvedValue(null);

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    const outputs = canvas.created.filter(
      (entry) => entry.draws[0]?.args.length === 4,
    );
    const plainOutput = outputs.find((entry) => entry.draws[0].image === PLAIN);
    const outlineOutput = outputs.find(
      (entry) => entry.draws[0].image === OUTLINED,
    );
    expect(plainOutput).toMatchObject({ width: 14, height: 20 });
    expect(plainOutput?.draws[0].args).toEqual([2, 4, 10, 16]);
    expect(outlineOutput).toMatchObject({ width: 14, height: 20 });
    expect(outlineOutput?.draws[0].args).toEqual([0, 0, 14, 20]);
  });

  it("keeps the tenure start and the existing figures for a returning holder", async () => {
    db.find.mockResolvedValue(existingRow());

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      heldSince: HELD_SINCE,
      imageKey: ALICE_IMAGE,
      outlineImageKey: ALICE_OUTLINE,
      value: "41.000",
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("re-renders for the same holder when the previous render failed", async () => {
    db.find.mockResolvedValue(
      existingRow({ imageKey: null, outlineImageKey: null }),
    );

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).toHaveBeenCalledTimes(2);
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      heldSince: HELD_SINCE,
      imageKey: expect.stringMatching(/^top-roles\/the_unrivaled\//),
    });
  });

  it("does not re-render a returning holder whose figure has no outline", async () => {
    db.find.mockResolvedValue(existingRow({ outlineImageKey: null }));

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(skinApi.render).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      heldSince: HELD_SINCE,
      imageKey: ALICE_IMAGE,
      outlineImageKey: null,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("stores only the plain figure when the outlined render fails", async () => {
    db.find.mockResolvedValue(null);
    skinApi.render.mockImplementation(
      async ({ options }: { options: { outline?: boolean } }) => {
        if (options.outline) throw new Error("outline down");
        return new Uint8Array([1]);
      },
    );

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(storedKeys()).toHaveLength(1);
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      imageKey: storedKeys()[0],
      outlineImageKey: null,
    });
  });

  it("stores only the plain figure when the outline does not line up", async () => {
    db.find.mockResolvedValue(null);
    canvas.outlined = MISALIGNED;

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(storedKeys()).toHaveLength(1);
    expect(db.upsert.mock.calls[0][0].outlineImageKey).toBeNull();
  });

  it("swaps the holder, resets the tenure and removes both old figures", async () => {
    db.find.mockResolvedValue(existingRow());

    await new TopRoleHolderService().record(RECORDS_RULE, BOB);

    const row = db.upsert.mock.calls[0][0];
    expect(row.discordId).toBe(BOB.discordId);
    expect(row.heldSince.getTime()).toBeGreaterThan(HELD_SINCE.getTime());
    expect(row.imageKey).toMatch(
      new RegExp(`^top-roles/the_unrivaled/${BOB.minecraftUuid}-`),
    );
    expect(storage.delete).toHaveBeenCalledWith([ALICE_IMAGE, ALICE_OUTLINE]);
  });

  it("stores the holder without a figure when the render fails", async () => {
    db.find.mockResolvedValue(null);
    skinApi.render.mockRejectedValue(new Error("skin-api down"));

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(storage.put).not.toHaveBeenCalled();
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      imageKey: null,
      outlineImageKey: null,
    });
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
    skinApi.render.mockImplementation(
      async ({ options }: { options: { outline?: boolean } }) => {
        if (options.outline) throw new Error("outline down");
        return new Uint8Array([1]);
      },
    );
    const service = new TopRoleHolderService();

    canvas.plain = { width: 1365, height: 2048, data: new Uint8ClampedArray() };
    await service.record(RECORDS_RULE, ALICE);
    expect(canvas.created[0]).toMatchObject({ width: 800, height: 1200 });

    canvas.plain = { width: 581, height: 872, data: new Uint8ClampedArray() };
    await service.record(RECORDS_RULE, BOB);
    expect(canvas.created[1]).toMatchObject({ width: 581, height: 872 });
  });
});

describe("TopRoleHolderService.record reigns", () => {
  it("opens a reign for a first holder, starting when the tenure starts", async () => {
    db.find.mockResolvedValue(null);

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    const heldSince = db.upsert.mock.calls[0][0].heldSince;
    expect(db.reignFindOpen).toHaveBeenCalledWith("the_unrivaled");
    expect(db.reignUpdate).not.toHaveBeenCalled();
    expect(db.reignCreate).toHaveBeenCalledWith({
      roleKey: "the_unrivaled",
      discordId: ALICE.discordId,
      minecraftUuid: ALICE.minecraftUuid,
      startedAt: heldSince,
      startValue: "41.000",
      lastValue: "41.000",
    });
  });

  it("only refreshes the latest value while the same holder keeps the title", async () => {
    db.find.mockResolvedValue(existingRow());
    db.reignFindOpen.mockResolvedValue(openReign());

    await new TopRoleHolderService().record(RECORDS_RULE, ALICE);

    expect(db.reignUpdate).toHaveBeenCalledWith(
      { id: 7 },
      { minecraftUuid: ALICE.minecraftUuid, lastValue: "41.000" },
    );
    expect(db.reignCreate).not.toHaveBeenCalled();
  });

  it("closes the previous reign and opens a new one when the title changes hands", async () => {
    db.find.mockResolvedValue(existingRow());
    db.reignFindOpen.mockResolvedValue(openReign());

    await new TopRoleHolderService().record(RECORDS_RULE, BOB);

    const heldSince = db.upsert.mock.calls[0][0].heldSince;
    expect(db.reignUpdate).toHaveBeenCalledWith(
      { id: 7 },
      { endedAt: heldSince },
    );
    expect(db.reignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: BOB.discordId,
        startedAt: heldSince,
        startValue: "12.000",
      }),
    );
  });
});

describe("TopRoleHolderService.clear", () => {
  it("deletes the row and both stored figures", async () => {
    db.find.mockResolvedValue(existingRow());

    await new TopRoleHolderService().clear(RECORDS_RULE);

    expect(db.delete).toHaveBeenCalledWith({ roleKey: "the_unrivaled" });
    expect(db.reignUpdateAll).toHaveBeenCalledWith(
      { endedAt: expect.any(Date) },
      { roleKey: "the_unrivaled", endedAt: null },
    );
    expect(storage.delete).toHaveBeenCalledWith([ALICE_IMAGE, ALICE_OUTLINE]);
  });

  it("is a no-op when nobody holds the role", async () => {
    db.find.mockResolvedValue(null);

    await new TopRoleHolderService().clear(RECORDS_RULE);

    expect(db.delete).not.toHaveBeenCalled();
    expect(db.reignUpdateAll).not.toHaveBeenCalled();
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
        imageUrl: `https://assets.test/${ALICE_IMAGE}`,
        outlineImageUrl: `https://assets.test/${ALICE_OUTLINE}`,
      },
    });
    expect(roles[1]).toMatchObject({
      metric: "playtime",
      pose: "zombie",
      holder: null,
    });
  });

  it("reports a holder without a figure as empty image urls", async () => {
    db.getAll.mockResolvedValue([existingRow({ imageKey: null })]);
    db.players.mockResolvedValue([
      { minecraftUuid: ALICE.minecraftUuid, minecraftUsername: "alice" },
    ]);

    const [records] = await new TopRoleHolderService().list();

    expect(records.holder?.imageUrl).toBeNull();
    expect(records.holder?.outlineImageUrl).toBeNull();
  });

  it("keeps holder Discord IDs out of the public view", async () => {
    db.getAll.mockResolvedValue([existingRow()]);
    db.players.mockResolvedValue([
      { minecraftUuid: ALICE.minecraftUuid, minecraftUsername: "alice" },
    ]);

    const [records] = await new TopRoleHolderService().list();

    expect(Object.keys(records.holder ?? {}).sort()).toEqual([
      "heldSince",
      "imageUrl",
      "minecraftUsername",
      "minecraftUuid",
      "outlineImageUrl",
      "value",
    ]);
  });
});
