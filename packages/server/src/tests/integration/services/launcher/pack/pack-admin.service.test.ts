import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

vi.mock("@/services/curseforge/files", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/files")>();
  return {
    ...actual,
    getFilesDetails: vi.fn(async () => []),
    getServedFileIds: vi.fn(async (fileIds: number[]) => new Set(fileIds)),
  };
});
vi.mock("@/services/curseforge/modpack", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/modpack")>();
  return { ...actual, getModpackFile: vi.fn(async () => null) };
});
vi.mock("@/services/curseforge/downloads", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/downloads")>();
  return { ...actual, resolveFileDownloads: vi.fn(async () => new Map()) };
});
vi.mock("@/services/curseforge/ingest", () => ({
  ingestProjectsWhere: vi.fn(async () => 0),
  refreshProjects: vi.fn(async () => 0),
}));
vi.mock("@/services/launcher/pack/sandbox-files", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/launcher/pack/sandbox-files")
  >()),
  findSandboxFileUrls: vi.fn(async () => new Map()),
  findSandboxSnapshotUrl: vi.fn(async () => null),
  openSandboxFile: vi.fn(async () => null),
}));
vi.mock("@/services/content-gateway/minecraft", () => ({
  getMinecraftJavaMajorVersion: vi.fn(async () => 21),
}));

import config from "@/config";
import { Q } from "@/db";
import type { LauncherPack } from "@createrington/shared/db";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { launcherPackAdminService } from "@/services/launcher/pack/pack-admin.service";
import { settings } from "@/services/settings";
import { NotFoundError } from "@/db/utils";
import { seedModpack } from "@/tests/helpers/workshop";
import {
  PACK_PROJECT_ID,
  PACK_SLUG,
  PACK_ORDER_FOR_TESTS,
  ctx,
  seedFile,
  serveFromCurseForge,
  seedReadyRelease,
  seedPackProject,
  offerToLauncher,
  seedPack,
  refusal,
  useLauncherPackTestHooks,
} from "@/tests/helpers/launcher-pack-harness";

useLauncherPackTestHooks();

describe("LauncherPackAdminService.seedDefaultPack", () => {
  const originalPackProjectId = config.curseforge.modpackProjectId;
  const SEEDED_KEY = "launcher_packs_seeded";
  let storedPacks: LauncherPack[] = [];
  let storedSeeded: Record<string, unknown> | null = null;

  beforeEach(async () => {
    storedPacks = await Q.launcher.pack.getAll();
    await Q.launcher.pack.deleteAll({
      id: { $in: storedPacks.map((p) => p.id) },
    });
    storedSeeded =
      (await Q.app.setting.find({ key: SEEDED_KEY }))?.value ?? null;
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
  });

  afterEach(async () => {
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      originalPackProjectId;
    await Q.launcher.pack.deleteAll({ slug: "createrington" });
    for (const pack of storedPacks) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...row } = pack;
      await Q.launcher.pack.create(row);
    }
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
    if (storedSeeded !== null) {
      await Q.app.setting.create({ key: SEEDED_KEY, value: storedSeeded });
    }
  });

  it("does not seed again after the owner removed every pack", async () => {
    await seedPackProject(PACK_PROJECT_ID);
    await seedModpack(ctx, { curseforgeProjectId: PACK_PROJECT_ID });
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;
    await launcherPackAdminService.seedDefaultPack();
    await Q.launcher.pack.deleteAll({ slug: "createrington" });

    await launcherPackAdminService.seedDefaultPack();

    expect(await Q.launcher.pack.count()).toBe(0);
    expect(await settings.getLauncherPacksSeeded()).toBe(true);
  });

  it("seeds on a later start once a modpack carries the configured project", async () => {
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;
    await launcherPackAdminService.seedDefaultPack();
    expect(await settings.getLauncherPacksSeeded()).toBe(false);
    await seedPackProject(PACK_PROJECT_ID);
    await seedModpack(ctx, { curseforgeProjectId: PACK_PROJECT_ID });

    await launcherPackAdminService.seedDefaultPack();

    expect((await Q.launcher.pack.getAll()).map((p) => p.slug)).toEqual([
      "createrington",
    ]);
  });

  it("offers the modpack linked to the configured project as the createrington pack", async () => {
    await seedPackProject(PACK_PROJECT_ID);
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID,
    });
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;

    await launcherPackAdminService.seedDefaultPack();

    const packs = await Q.launcher.pack.getAll();
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({
      slug: "createrington",
      modpackId: modpack.id,
      source: "curseforge",
      enabled: true,
    });
    expect((await launcherPackService.listPacks()).map((p) => p.slug)).toEqual([
      "createrington",
    ]);
  });

  it("does nothing while no modpack carries the configured project", async () => {
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID + 99;

    await launcherPackAdminService.seedDefaultPack();

    expect(await Q.launcher.pack.count()).toBe(0);
  });

  it("does nothing once any pack is stored", async () => {
    await seedPackProject(PACK_PROJECT_ID);
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID,
    });
    const other = await seedModpack(ctx, { name: "Vitest Other" });
    await offerToLauncher(other, { slug: "vitest-other", source: "sandbox" });
    (config.curseforge as { modpackProjectId: number }).modpackProjectId =
      PACK_PROJECT_ID;

    await launcherPackAdminService.seedDefaultPack();

    const packs = await Q.launcher.pack.getAll();
    expect(packs.map((p) => p.slug)).toEqual(["vitest-other"]);
    expect(packs[0].modpackId).not.toBe(modpack.id);
    expect(await settings.getLauncherPacksSeeded()).toBe(true);
  });
});

describe("LauncherPackAdminService owner methods", () => {
  const SEEDED_KEY = "launcher_packs_seeded";
  let storedSeeded: Record<string, unknown> | null = null;

  beforeEach(async () => {
    storedSeeded =
      (await Q.app.setting.find({ key: SEEDED_KEY }))?.value ?? null;
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
  });

  afterEach(async () => {
    await Q.app.setting.deleteAll({ key: SEEDED_KEY });
    if (storedSeeded !== null) {
      await Q.app.setting.create({ key: SEEDED_KEY, value: storedSeeded });
    }
  });

  const owned = async () =>
    (await launcherPackAdminService.listOwned()).filter((pack) =>
      ctx.modpackIds.includes(pack.modpackId),
    );

  it("adds a pack last in the list and records that a pack was stored", async () => {
    const first = await seedPack();
    const test = await seedModpack(ctx, { name: "Vitest Test Server" });

    const added = await launcherPackAdminService.addPack({
      slug: "vitest-test",
      modpackId: test.id,
      source: "sandbox",
    });

    const packs = await owned();
    expect(added).toMatchObject({
      slug: "vitest-test",
      modpackId: test.id,
      source: "sandbox",
      enabled: true,
    });
    expect(packs.map((pack) => pack.slug)).toEqual([PACK_SLUG, "vitest-test"]);
    expect(packs[1].position).toBeGreaterThan(packs[0].position);
    expect(packs[0].modpack).toEqual({
      id: first.id,
      name: first.name,
      curseforgeProjectId: PACK_PROJECT_ID,
      serverId: null,
    });
    expect(await settings.getLauncherPacksSeeded()).toBe(true);
  });

  it("refuses a CurseForge pack for a modpack without a project", async () => {
    const modpack = await seedModpack(ctx, { name: "Vitest Unlinked" });

    await expect(
      launcherPackAdminService.addPack({
        slug: "vitest-unlinked",
        modpackId: modpack.id,
        source: "curseforge",
      }),
    ).rejects.toThrow(/no CurseForge project/);

    expect(await Q.launcher.pack.find({ slug: "vitest-unlinked" })).toBeNull();
  });

  it("refuses a slug that is taken and a modpack that is already offered", async () => {
    const modpack = await seedPack();
    const other = await seedModpack(ctx, { name: "Vitest Other" });

    await expect(
      launcherPackAdminService.addPack({
        slug: PACK_SLUG,
        modpackId: other.id,
        source: "sandbox",
      }),
    ).rejects.toThrow(/already offers a pack as "vitest"/);
    await expect(
      launcherPackAdminService.addPack({
        slug: "vitest-again",
        modpackId: modpack.id,
        source: "curseforge",
      }),
    ).rejects.toThrow(/already offers "Vitest Pack"/);
  });

  it("refuses to add a pack for a modpack that does not exist", async () => {
    await expect(
      launcherPackAdminService.addPack({
        slug: "vitest-ghost",
        modpackId: 999_999_999,
        source: "sandbox",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("lists the modpacks the launcher is not offered yet", async () => {
    const offered = await seedPack();
    const free = await seedModpack(ctx, { name: "Vitest Free" });

    const candidates = await launcherPackAdminService.listCandidates();
    const ids = candidates.map((modpack) => modpack.id);

    expect(ids).toContain(free.id);
    expect(ids).not.toContain(offered.id);
  });

  it("hides and shows a pack without touching its releases", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    const [pack] = await owned();

    const hidden = await launcherPackAdminService.setPackEnabled(
      pack.id,
      false,
    );
    const listedWhileHidden = await launcherPackService.listPacks();
    const shown = await launcherPackAdminService.setPackEnabled(pack.id, true);

    expect(hidden.enabled).toBe(false);
    expect(listedWhileHidden.map((p) => p.slug)).not.toContain(PACK_SLUG);
    expect(shown.enabled).toBe(true);
    expect((await owned())[0].latestVersion).toBe("1.0.0");
  });

  it("refuses to hide a pack that does not exist", async () => {
    await expect(
      launcherPackAdminService.setPackEnabled(999_999_999, false),
    ).rejects.toThrow(NotFoundError);
  });

  it("puts the packs in the given order", async () => {
    await seedPack();
    const second = await seedModpack(ctx, { name: "Vitest Second" });
    const third = await seedModpack(ctx, { name: "Vitest Third" });
    await launcherPackAdminService.addPack({
      slug: "vitest-second",
      modpackId: second.id,
      source: "sandbox",
    });
    await launcherPackAdminService.addPack({
      slug: "vitest-third",
      modpackId: third.id,
      source: "sandbox",
    });
    const before = await owned();

    const mine = new Set(before.map((pack) => pack.id));
    const others = (await Q.launcher.pack.findAll({}, PACK_ORDER_FOR_TESTS))
      .map((pack) => pack.id)
      .filter((id) => !mine.has(id));

    await launcherPackAdminService.reorderPacks([
      ...others,
      before[2].id,
      before[0].id,
      before[1].id,
    ]);

    expect((await owned()).map((pack) => pack.slug)).toEqual([
      "vitest-third",
      PACK_SLUG,
      "vitest-second",
    ]);
    expect((await launcherPackService.listPacks()).map((p) => p.slug)).toEqual([
      "vitest-third",
      PACK_SLUG,
      "vitest-second",
    ]);
  });

  it("refuses an order that does not name every pack exactly once", async () => {
    await seedPack();
    const [pack] = await owned();
    const all = await Q.launcher.pack.findAll({});

    await expect(
      launcherPackAdminService.reorderPacks([pack.id, pack.id]),
    ).rejects.toThrow(/every launcher pack exactly once/);
    await expect(
      launcherPackAdminService.reorderPacks([
        ...all.map((p) => p.id),
        999_999_999,
      ]),
    ).rejects.toThrow(/every launcher pack exactly once/);
    if (all.length > 1) {
      await expect(
        launcherPackAdminService.reorderPacks([pack.id]),
      ).rejects.toThrow(/every launcher pack exactly once/);
    }
  });

  it("removes a pack and keeps its modpack and releases", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release } = await seedReadyRelease(modpack, "1.0.0", [file]);
    const [pack] = await owned();

    const removed = await launcherPackAdminService.removePack(pack.id);
    const latest = await refusal(launcherPackService.getLatestPack(PACK_SLUG));

    expect(removed.slug).toBe(PACK_SLUG);
    expect(await Q.launcher.pack.find({ id: pack.id })).toBeNull();
    expect(await Q.modpack.find({ id: modpack.id })).not.toBeNull();
    expect(await Q.modpack.release.find({ id: release.id })).not.toBeNull();
    expect(latest.code).toBe("PACK_NOT_FOUND");
    await expect(launcherPackAdminService.removePack(pack.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
