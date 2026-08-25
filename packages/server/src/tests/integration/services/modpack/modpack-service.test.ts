import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";

vi.mock("@/services/workshop/discord", () => ({
  discordThreadUrl: vi.fn(
    (threadId: string) => `https://discord.com/channels/0/${threadId}`,
  ),
  listForumChannels: vi.fn(async () => []),
  assertForumChannel: vi.fn(async () => undefined),
  announceSuggestion: vi.fn(async () => undefined),
  announceReview: vi.fn(async () => undefined),
  announcePackDropOut: vi.fn(async () => undefined),
  announcePulledDependencies: vi.fn(async () => undefined),
  announceRemoval: vi.fn(async () => undefined),
  healThreads: vi.fn(async () => undefined),
}));

vi.mock("@/services/curseforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/curseforge")>();
  return {
    ...actual,
    getMod: vi.fn(async () => {
      throw new Error("getMod must not be called in this suite");
    }),
    getMods: vi.fn(async () => []),
    getModpackManifest: vi.fn(async () => ({
      fileId: 1,
      serverPackFileId: null,
      displayName: null,
      version: null,
      minecraftVersion: null,
      modLoader: null,
      publishedAt: null,
      entries: [],
      modIds: new Set<number>(),
      disabledModIds: new Set<number>(),
    })),
    getModpackModIds: vi.fn(async () => new Set<number>()),
    getModpackFile: vi.fn(async () => null),
    searchMods: vi.fn(async () => []),
    getFilesDependencies: vi.fn(async () => []),
    getFilesDetails: vi.fn(async () => []),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  ingestProjects: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

vi.mock("@/services/modpack/changelog", () => ({
  announceReleaseChangelog: vi.fn(async () => undefined),
}));

import pool, { Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { modpackService } from "@/services/modpack";
import { workshopService } from "@/services/workshop";
import {
  CurseForgeClass,
  getFilesDetails,
  getModpackFile,
  getModpackManifest,
  type ModpackFile,
  type ModpackManifest,
  type ModpackManifestSides,
} from "@/services/curseforge";
import {
  announcePackDropOut,
  announceReview,
} from "@/services/workshop/discord";
import { announceReleaseChangelog } from "@/services/modpack/changelog";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  modEvents,
  seedModpack,
  seedWorkshop,
  seedMod,
  seedPackMod,
  seedProject,
  seedRequiredDependency,
} from "@/tests/helpers/workshop";

const USER_A = "999900000000000002";
const ADMIN = "999900000000000001";

let manifestFileId = 0;

// Test project ids are ~992_000_000, so a derived file id has to stay in int4
const fileIdFor = (projectId: number) => 700_000 + (projectId % 100_000);

function manifest(
  overrides: Partial<Omit<ModpackManifest, "entries">> & {
    modIds?: Set<number>;
    disabledModIds?: Set<number>;
    entries?: Array<{
      projectId: number;
      fileId: number;
      required?: boolean;
      sides?: ModpackManifestSides;
    }>;
  } = {},
): ModpackManifest {
  const modIds = overrides.modIds ?? new Set<number>();
  const disabledModIds = overrides.disabledModIds ?? new Set<number>();
  const serverPackFileId = overrides.serverPackFileId ?? null;
  const entries: NonNullable<typeof overrides.entries> =
    overrides.entries ??
    [...modIds].map((projectId) => ({
      projectId,
      fileId: fileIdFor(projectId),
    }));
  return {
    fileId: ++manifestFileId,
    displayName: null,
    version: null,
    minecraftVersion: null,
    modLoader: null,
    publishedAt: null,
    ...overrides,
    serverPackFileId,
    entries: entries.map((entry) => ({
      ...entry,
      required: entry.required ?? !disabledModIds.has(entry.projectId),
      sides: entry.sides ?? (serverPackFileId === null ? "client" : "both"),
    })),
    modIds,
    disabledModIds,
  };
}

function sidedManifest(
  version: string,
  sided: Array<[projectId: number, sides: ModpackManifestSides]>,
): ModpackManifest {
  const built = manifest({
    version,
    modIds: new Set(sided.map(([projectId]) => projectId)),
    entries: sided.map(([projectId, sides]) => ({
      projectId,
      fileId: fileIdFor(projectId),
      sides,
    })),
  });
  return { ...built, serverPackFileId: 800_000 + built.fileId };
}

function requiredOf(
  rows: Array<{ curseforgeProjectId: number; required: boolean }>,
  projectId: number,
) {
  return rows.find((row) => row.curseforgeProjectId === projectId)?.required;
}

const ctx = createWorkshopTestContext(992_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
});

afterEach(async () => {
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("ModpackService.getWorkshopAttention", () => {
  it("flags a rejected required dependency of a pack member", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    const depProjectId = await seedProject(ctx, "Rejected Dep");
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    const depMod = await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual({
      type: "rejected_dependency",
      workshopModId: depMod.id,
      curseforgeProjectId: depProjectId,
      name: "Rejected Dep",
      websiteUrl: null,
      requiredBy: [
        {
          curseforgeProjectId: member.curseforgeProjectId,
          name: `Vitest Mod ${member.curseforgeProjectId}`,
        },
      ],
    });
  });

  it("flags a rejected required dependency of mods still walking review", async () => {
    const workshop = await seedWorkshop(ctx);
    const approved = await seedMod(ctx, workshop, {
      status: "approved",
      submittedBy: USER_A,
    });
    const inTesting = await seedMod(ctx, workshop, {
      status: "testing",
      submittedBy: USER_A,
    });
    const depProjectId = await seedProject(ctx, "Rejected Dep");
    const depMod = await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });
    for (const subject of [approved, inTesting]) {
      await seedRequiredDependency(
        workshop,
        subject.curseforgeProjectId,
        depProjectId,
      );
    }

    const items = await modpackService.getWorkshopAttention(workshop);

    const rejected = items.flatMap((item) =>
      item.type === "rejected_dependency" ? [item] : [],
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      workshopModId: depMod.id,
      curseforgeProjectId: depProjectId,
    });
    expect(
      rejected[0].requiredBy.map((entry) => entry.curseforgeProjectId).sort(),
    ).toEqual(
      [approved.curseforgeProjectId, inTesting.curseforgeProjectId].sort(),
    );
  });

  it("does not flag a rejected dependency wanted only by a pending suggestion", async () => {
    const workshop = await seedWorkshop(ctx);
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const depProjectId = await seedProject(ctx);
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });
    await seedRequiredDependency(
      workshop,
      pending.curseforgeProjectId,
      depProjectId,
    );

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "rejected_dependency"),
    ).toHaveLength(0);
  });

  it("keeps in-review dependency gaps scoped to shipping mods", async () => {
    const workshop = await seedWorkshop(ctx);
    const approved = await seedMod(ctx, workshop, {
      status: "approved",
      submittedBy: USER_A,
    });
    const depProjectId = await seedProject(ctx);
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "testing",
      submittedBy: USER_A,
    });
    await seedRequiredDependency(
      workshop,
      approved.curseforgeProjectId,
      depProjectId,
    );

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "unpromoted_dependency"),
    ).toHaveLength(0);
  });

  it("does not flag a rejected dependency that is itself in the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    const dep = await seedPackMod(ctx, workshop, { origin: "dependency" });
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      dep.curseforgeProjectId,
    );
    await seedMod(ctx, workshop, {
      curseforgeProjectId: dep.curseforgeProjectId,
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "rejected_dependency"),
    ).toHaveLength(0);
  });

  it("flags a required dependency that has not reached the pack yet", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    const depProjectId = await seedProject(ctx, "Testing Dep");
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    const depMod = await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "testing",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual({
      type: "unpromoted_dependency",
      workshopModId: depMod.id,
      curseforgeProjectId: depProjectId,
      name: "Testing Dep",
      websiteUrl: null,
      requiredBy: [
        {
          curseforgeProjectId: member.curseforgeProjectId,
          name: `Vitest Mod ${member.curseforgeProjectId}`,
        },
      ],
    });
  });

  it("does not flag an unpromoted dependency that already shipped", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    await seedMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      status: "pending",
      submittedBy: USER_A,
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      liveAt: new Date(),
      liveInVersion: "2.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set([depProjectId]) }),
    );

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "unpromoted_dependency"),
    ).toHaveLength(0);
    expect(
      items.filter((item) => item.type === "shipped_unreviewed"),
    ).toHaveLength(1);
  });

  it("flags active members whose project has no environment", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual({
      type: "environment_unspecified",
      workshopModId: null,
      curseforgeProjectId: member.curseforgeProjectId,
      name: `Vitest Mod ${member.curseforgeProjectId}`,
      websiteUrl: null,
    });
  });

  it("flags projects listed more than once in the published manifest", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
        entries: [
          { projectId: member.curseforgeProjectId, fileId: 1 },
          { projectId: member.curseforgeProjectId, fileId: 2 },
        ],
      }),
    );

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual({
      type: "duplicate_manifest_entry",
      curseforgeProjectId: member.curseforgeProjectId,
      name: `Vitest Mod ${member.curseforgeProjectId}`,
      websiteUrl: null,
    });
  });

  it("flags unclassified suggestions in testing with their mod id", async () => {
    const workshop = await seedWorkshop(ctx);
    const inTesting = await seedMod(ctx, workshop, {
      status: "testing",
      submittedBy: USER_A,
    });
    await seedMod(ctx, workshop, {
      status: "pending",
      submittedBy: USER_A,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    const envItems = items.filter(
      (item) => item.type === "environment_unspecified",
    );
    expect(envItems).toEqual([
      {
        type: "environment_unspecified",
        workshopModId: inTesting.id,
        curseforgeProjectId: inTesting.curseforgeProjectId,
        name: `Vitest Mod ${inTesting.curseforgeProjectId}`,
        websiteUrl: null,
      },
    ]);
  });

  it("carries the project's CurseForge url so the issue can link out", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);
    await Q.curseforge.project.update(
      { id: member.curseforgeProjectId },
      { websiteUrl: "https://www.curseforge.com/minecraft/mc-mods/vitest-mod" },
    );

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(items).toContainEqual(
      expect.objectContaining({
        type: "environment_unspecified",
        curseforgeProjectId: member.curseforgeProjectId,
        websiteUrl: "https://www.curseforge.com/minecraft/mc-mods/vitest-mod",
      }),
    );
  });

  it("flags a project once, preferring the suggestion over the member row", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      status: "next_update",
      submittedBy: USER_A,
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "environment_unspecified"),
    ).toEqual([
      {
        type: "environment_unspecified",
        workshopModId: mod.id,
        curseforgeProjectId: mod.curseforgeProjectId,
        name: `Vitest Mod ${mod.curseforgeProjectId}`,
        websiteUrl: null,
      },
    ]);
  });

  it("does not flag classified or dropped members", async () => {
    const workshop = await seedWorkshop(ctx);
    const classified = await seedPackMod(ctx, workshop);
    await Q.curseforge.project.update(
      { id: classified.curseforgeProjectId },
      { environment: "both", environmentSource: "manual" },
    );
    await seedPackMod(ctx, workshop, {
      droppedFromManifestAt: new Date(),
    });

    const items = await modpackService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "environment_unspecified"),
    ).toHaveLength(0);
  });
});

describe("ModpackService.reconcile", () => {
  it("gives a staged suggestion its row once the pack ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileId: 123,
      fileName: "shipped.jar",
      fileReleaseType: 1,
    });
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: fileIdFor(mod.curseforgeProjectId),
        projectId: mod.curseforgeProjectId,
        displayName: "Shipped 2.0",
        fileName: "shipped-2.0.jar",
        fileDate: null,
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "3.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    // The manifest wins over the file the suggester happened to link
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).toMatchObject({
      origin: "suggestion",
      workshopModId: mod.id,
      fileId: fileIdFor(mod.curseforgeProjectId),
      fileName: "shipped-2.0.jar",
      liveInVersion: "3.0.0",
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileId: 123,
      fileName: "shipped.jar",
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
    });
  });

  it("leaves a staged suggestion alone until the pack ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "3.0.0", modIds: new Set<number>() }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.modpack.mod.count({ modpackId: modpack.id })).toBe(0);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "next_update",
    });
  });

  it("marks members live from the manifest and imports stowaways", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const stowawayId = await seedProject(ctx);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId, stowawayId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    const live = await Q.modpack.mod.get({ id: member.id });
    expect(live.liveAt).not.toBeNull();
    expect(live.liveInVersion).toBe("2.0.0");
    expect(live.droppedFromManifestAt).toBeNull();

    const imported = await Q.modpack.mod.find({
      modpackId: modpack.id,
      curseforgeProjectId: stowawayId,
    });
    expect(imported).not.toBeNull();
    expect(imported).toMatchObject({
      origin: "import",
      workshopModId: null,
      liveInVersion: "2.0.0",
    });
    expect(imported!.liveAt).not.toBeNull();
  });

  it("keeps non-mod manifest entries as members and exposes their class", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const shaderId = await seedProject(ctx, "Complementary Shaders", {
      classId: CurseForgeClass.shaders,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set([shaderId]) }),
    );

    await modpackService.reconcile(modpack.id);

    const members = await modpackService.getPackMods(modpack.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      curseforgeProjectId: shaderId,
      origin: "import",
      liveInVersion: "2.0.0",
      project: { classId: CurseForgeClass.shaders },
    });

    const [release] = await modpackService.listReleases(modpack.id);
    const frozen = await modpackService.getReleaseMods(release.id);
    expect(frozen).toHaveLength(1);
    expect(frozen[0]).toMatchObject({
      curseforgeProjectId: shaderId,
      classId: CurseForgeClass.shaders,
    });
  });

  it("mirrors the manifest required flag onto members and frozen releases", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const disabledId = await seedProject(ctx, "Create: Rolling Tones");
    const activeId = await seedProject(ctx, "Create");
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([disabledId, activeId]),
        disabledModIds: new Set([disabledId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    const members = await modpackService.getPackMods(modpack.id);
    expect(requiredOf(members, disabledId)).toBe(false);
    expect(requiredOf(members, activeId)).toBe(true);
    const [first] = await modpackService.listReleases(modpack.id);
    const frozen = await modpackService.getReleaseMods(first.id);
    expect(requiredOf(frozen, disabledId)).toBe(false);
    expect(requiredOf(frozen, activeId)).toBe(true);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set([disabledId, activeId]) }),
    );
    await modpackService.reconcile(modpack.id);

    const reenabled = await modpackService.getPackMods(modpack.id);
    expect(requiredOf(reenabled, disabledId)).toBe(true);
    const latest = (await modpackService.listReleases(modpack.id)).find(
      (release) => release.version === "2.1.0",
    );
    const diff = await modpackService.getReleaseDiff(latest!.id);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]).toMatchObject({
      curseforgeProjectId: disabledId,
      required: true,
      previousFile: { required: false },
    });
    expect(diff.unchanged).toBe(1);
  });

  it("moves a shipped suggestion to in_pack and back when it drops out", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileChosen: true,
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
      fileChosen: false,
    });
    expect(vi.mocked(announceReview)).toHaveBeenCalledTimes(1);

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "shipped",
      workshopId: workshop.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      actorDiscordId: null,
      fromStatus: "next_update",
      toStatus: "in_pack",
      releaseVersion: "2.0.0",
    });

    // A second sweep over the same manifest must not re-announce
    await modpackService.reconcile(modpack.id);
    expect(vi.mocked(announceReview)).toHaveBeenCalledTimes(1);
    expect(await modEvents(mod.id)).toHaveLength(1);

    await Q.workshop.mod.updateAll({ fileChosen: true }, { id: mod.id });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set<number>() }),
    );
    await modpackService.reconcile(modpack.id);

    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "next_update",
      fileChosen: false,
    });
    expect(vi.mocked(announcePackDropOut)).toHaveBeenCalledTimes(1);

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(2);
    });
    expect((await modEvents(mod.id))[1]).toMatchObject({
      eventType: "dropped",
      fromStatus: "in_pack",
      toStatus: "next_update",
      releaseVersion: "2.1.0",
    });
  });

  it("keeps a rejected mod's row while the pack still ships it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "incompatible",
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).not.toBeNull();
    const items = await modpackService.getWorkshopAttention(workshop);
    expect(
      items.filter((item) => item.type === "shipped_rejected"),
    ).toHaveLength(1);
  });

  it("flags dropped live members and deletes dropped import rows", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const suggestion = await seedMod(ctx, workshop, {
      status: "in_pack",
      submittedBy: USER_A,
    });
    const suggestionRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: suggestion.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: suggestion.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const importRow = await seedPackMod(ctx, workshop, {
      origin: "import",
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await modpackService.reconcile(modpack.id);

    const dropped = await Q.modpack.mod.get({ id: suggestionRow.id });
    expect(dropped.liveAt).toBeNull();
    expect(dropped.liveInVersion).toBeNull();
    expect(dropped.droppedFromManifestAt).not.toBeNull();
    expect(await Q.modpack.mod.find({ id: importRow.id })).toBeNull();
  });

  it("resets a dropped suggestion's required intent to what the pack last published", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const suggestion = await seedMod(ctx, workshop, {
      status: "in_pack",
      submittedBy: USER_A,
      required: false,
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: suggestion.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: suggestion.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
      required: true,
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.workshop.mod.get({ id: suggestion.id })).toMatchObject({
      status: "next_update",
      required: true,
    });
  });

  it("clears the dropped flag when the mod ships again", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
      droppedFromManifestAt: new Date(),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    const healed = await Q.modpack.mod.get({ id: member.id });
    expect(healed.droppedFromManifestAt).toBeNull();
    expect(healed.liveAt).not.toBeNull();
    expect(healed.liveInVersion).toBe("1.0.0");
  });

  it("credits a shipped mod to its suggestion and ships it even mid review", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([pending.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: pending.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: pending.id });
    expect(await Q.workshop.mod.get({ id: pending.id })).toMatchObject({
      status: "in_pack",
    });
    await vi.waitFor(async () => {
      expect(await modEvents(pending.id)).toHaveLength(1);
    });
    expect((await modEvents(pending.id))[0]).toMatchObject({
      eventType: "shipped",
      fromStatus: "pending",
      toStatus: "in_pack",
      releaseVersion: "2.0.0",
    });
  });

  it("heals a linked suggestion the pack ships but the pipeline left behind", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
      liveAt: new Date(),
      liveInVersion: "2.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
    });
    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "shipped",
      fromStatus: "approved",
      toStatus: "in_pack",
      releaseVersion: "2.0.0",
    });
  });

  it("links a shipped mod to its rejected suggestion without unrejecting it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: mod.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: mod.id });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    expect(vi.mocked(announceReview)).not.toHaveBeenCalled();
    expect(await modEvents(mod.id)).toHaveLength(0);
  });

  it("drops a mid-review shipped mod back to next_update like any other member", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([mod.curseforgeProjectId]),
      }),
    );
    await modpackService.reconcile(modpack.id);
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("in_pack");

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.1.0", modIds: new Set<number>() }),
    );
    await modpackService.reconcile(modpack.id);

    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe(
      "next_update",
    );
    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(2);
    });
    expect((await modEvents(mod.id))[1]).toMatchObject({
      eventType: "dropped",
      fromStatus: "in_pack",
      toStatus: "next_update",
      releaseVersion: "2.1.0",
    });
  });

  it("classifies a shipped required dependency of a shipped mod", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const depProjectId = await seedProject(ctx);
    const strangerId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([mod.curseforgeProjectId, depProjectId, strangerId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: depProjectId,
      }),
    ).toMatchObject({ origin: "dependency" });
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: strangerId,
      }),
    ).toMatchObject({ origin: "import" });
  });
});

describe("ModpackService.reconcile across the client file and server pack", () => {
  it("keeps a client-only member live when only the client manifest lists it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const clientOnly = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [shared.curseforgeProjectId, "both"],
        [clientOnly.curseforgeProjectId, "client"],
      ]),
    );

    await modpackService.reconcile(modpack.id);

    const row = await Q.modpack.mod.get({ id: clientOnly.id });
    expect(row.liveAt).not.toBeNull();
    expect(row.liveInVersion).toBe("2.0.0");
    expect(row.droppedFromManifestAt).toBeNull();
  });

  it("keeps a server-only member live when only the server pack lists it", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const serverOnly = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [shared.curseforgeProjectId, "both"],
        [serverOnly.curseforgeProjectId, "server"],
      ]),
    );

    await modpackService.reconcile(modpack.id);

    const row = await Q.modpack.mod.get({ id: serverOnly.id });
    expect(row.liveAt).not.toBeNull();
    expect(row.liveInVersion).toBe("2.0.0");
    expect(row.droppedFromManifestAt).toBeNull();
    const attention = await modpackService.getWorkshopAttention(workshop);
    expect(
      attention.filter((item) => item.type === "dropped_from_pack"),
    ).toEqual([]);
  });

  it("leaves unflagged members unspecified so they keep surfacing for review", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const bothId = await seedProject(ctx);
    const clientId = await seedProject(ctx);
    const serverId = await seedProject(ctx);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [
        [bothId, "both"],
        [clientId, "client"],
        [serverId, "server"],
      ]),
    );

    await modpackService.reconcile(modpack.id);

    for (const id of [bothId, clientId, serverId]) {
      expect(await Q.curseforge.project.get({ id })).toMatchObject({
        environment: "unspecified",
        environmentSource: null,
      });
    }
    const attention = await modpackService.getWorkshopAttention(workshop);
    expect(
      attention
        .filter((item) => item.type === "environment_unspecified")
        .map((item) => item.curseforgeProjectId)
        .sort(),
    ).toEqual([bothId, clientId, serverId].sort());
  });

  it("leaves a manual environment flag alone", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "client",
      environmentSource: "manual",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "both"]]),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "client",
      environmentSource: "manual",
    });
  });

  it("confirms a CurseForge hint the pack shipped to the same side(s)", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "both",
      environmentSource: "cf_flag",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "both"]]),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "manifest",
    });
  });

  it("leaves a CurseForge hint the pack disagrees with alone", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "both",
      environmentSource: "cf_flag",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "client"]]),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "cf_flag",
    });
  });

  it("keeps a flag cleared to unspecified clear across a reconcile", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "server",
      environmentSource: "manual",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[projectId, "server"]]),
    );
    await modpackService.reconcile(modpack.id);

    await workshopService.setProjectEnvironment(projectId, "unspecified");
    await modpackService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "unspecified",
      environmentSource: null,
    });
  });

  it("does not confirm environments when the release ships no server pack", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const projectId = await seedProject(ctx, undefined, {
      environment: "both",
      environmentSource: "cf_flag",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set([projectId]) }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "cf_flag",
    });
  });
});

describe("ModpackService.seedFromManifest", () => {
  const seed = ({
    modIds = [],
    disabledModIds = [],
    ...overrides
  }: Partial<
    Omit<Parameters<typeof modpackService.seedFromManifest>[1], "files">
  > & { modIds?: number[]; disabledModIds?: number[] } = {}) => ({
    version: null,
    minecraftVersion: null,
    modLoader: null,
    files: modIds.map((projectId) => ({
      projectId,
      required: !disabledModIds.includes(projectId),
    })),
    ...overrides,
  });

  it("keeps entries flagged not required as disabled members", async () => {
    const workshop = await seedWorkshop(ctx);
    const disabledId = await seedProject(ctx, "Disabled Mod");
    const activeId = await seedProject(ctx, "Active Mod");

    await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({ modIds: [disabledId, activeId], disabledModIds: [disabledId] }),
    );

    const members = await modpackService.getPackMods(workshop.modpackId);
    expect(requiredOf(members, disabledId)).toBe(false);
    expect(requiredOf(members, activeId)).toBe(true);
  });

  // CurseForge exports repeat a project that ships more than one file, so the
  // seed merges the entries and reports them instead of failing the import
  it("merges repeated projects and reports them", async () => {
    const workshop = await seedWorkshop(ctx);
    const repeated = await seedProject(ctx);
    const other = await seedProject(ctx);

    const result = await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({ modIds: [repeated, other, repeated] }),
    );

    expect(result).toMatchObject({
      modCount: 2,
      memberCount: 2,
      duplicateProjectIds: [repeated],
    });
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      2,
    );
  });

  it("refuses when the pack follows a published CurseForge project", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5100 });

    await expect(
      modpackService.seedFromManifest(
        modpack.id,
        seed({ modIds: [ctx.nextProjectId++] }),
      ),
    ).rejects.toThrow(BadRequestError);
  });

  it("seeds members as live imports and reports unresolved projects", async () => {
    const workshop = await seedWorkshop(ctx);
    const known = await seedProject(ctx);
    const unknown = ctx.nextProjectId++;

    const result = await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({
        version: "alpha-0.0.1",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.248",
        modIds: [known, unknown],
      }),
    );

    expect(result).toEqual({
      modCount: 2,
      memberCount: 1,
      unresolvedProjectIds: [unknown],
      duplicateProjectIds: [],
    });
    const member = await Q.modpack.mod.find({
      modpackId: workshop.modpackId,
      curseforgeProjectId: known,
    });
    expect(member).toMatchObject({
      origin: "import",
      workshopModId: null,
      liveInVersion: "alpha-0.0.1",
    });
    expect(member!.liveAt).not.toBeNull();
  });

  it("matches suggestions in any of the pack's workshops and moves staged ones", async () => {
    const modpack = await seedModpack(ctx);
    const closed = await seedWorkshop(ctx, {
      modpackId: modpack.id,
      status: "closed",
    });
    const staged = await seedMod(ctx, closed, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const open = await seedWorkshop(ctx, { modpackId: modpack.id });
    const pending = await seedMod(ctx, open, { submittedBy: USER_A });

    await modpackService.seedFromManifest(
      modpack.id,
      seed({
        version: "0.2.0",
        modIds: [staged.curseforgeProjectId, pending.curseforgeProjectId],
      }),
    );

    expect((await Q.workshop.mod.get({ id: staged.id })).status).toBe(
      "in_pack",
    );
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: staged.curseforgeProjectId,
      }),
    ).toMatchObject({
      origin: "suggestion",
      workshopModId: staged.id,
      liveInVersion: "0.2.0",
    });
    expect((await Q.workshop.mod.get({ id: pending.id })).status).toBe(
      "in_pack",
    );
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: pending.curseforgeProjectId,
      }),
    ).toMatchObject({ origin: "suggestion", workshopModId: pending.id });
  });

  it("re-seeds as a full sync without recording releases", async () => {
    const workshop = await seedWorkshop(ctx);
    const kept = await seedProject(ctx);
    const dropped = await seedProject(ctx);

    await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({ version: "0.1.0", modIds: [kept, dropped] }),
    );
    await modpackService.seedFromManifest(
      workshop.modpackId,
      seed({ version: "0.2.0", modIds: [kept] }),
    );

    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: dropped,
      }),
    ).toBeNull();
    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: kept,
      }),
    ).toMatchObject({ liveInVersion: "0.1.0" });
    expect(await modpackService.listReleases(workshop.modpackId)).toHaveLength(
      0,
    );
  });

  it("counts only the manifest's mods when a dropped suggestion member keeps its row", async () => {
    const modpack = await seedModpack(ctx);
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const staged = await seedMod(ctx, workshop, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const keeper = await seedProject(ctx);

    await modpackService.seedFromManifest(
      modpack.id,
      seed({
        version: "0.1.0",
        modIds: [staged.curseforgeProjectId, keeper],
      }),
    );
    expect((await Q.workshop.mod.get({ id: staged.id })).status).toBe(
      "in_pack",
    );

    const result = await modpackService.seedFromManifest(
      modpack.id,
      seed({ version: "0.2.0", modIds: [keeper] }),
    );

    expect(result).toEqual({
      modCount: 1,
      memberCount: 1,
      unresolvedProjectIds: [],
      duplicateProjectIds: [],
    });
    expect((await Q.workshop.mod.get({ id: staged.id })).status).toBe(
      "next_update",
    );
    const droppedRow = await Q.modpack.mod.find({
      modpackId: modpack.id,
      curseforgeProjectId: staged.curseforgeProjectId,
    });
    expect(droppedRow!.droppedFromManifestAt).not.toBeNull();
    expect(droppedRow!.liveAt).toBeNull();
  });

  it("rejects a manifest for a different game version or loader", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    await expect(
      modpackService.seedFromManifest(
        workshop.modpackId,
        seed({ minecraftVersion: "1.20.1", modIds: [projectId] }),
      ),
    ).rejects.toThrow("targets Minecraft 1.20.1");
    await expect(
      modpackService.seedFromManifest(
        workshop.modpackId,
        seed({ modLoader: "fabric-0.16.9", modIds: [projectId] }),
      ),
    ).rejects.toThrow("does not match this pack's mod loader");
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      0,
    );
  });
});

describe("ModpackService.getPackMods", () => {
  it("attributes a suggestion member to the workshop it came from", async () => {
    const modpack = await seedModpack(ctx);
    const first = await seedWorkshop(ctx, { modpackId: modpack.id });
    const second = await seedWorkshop(ctx, {
      modpackId: modpack.id,
      name: "Vitest QoL Round",
    });
    const suggestion = await seedMod(ctx, second, {
      status: "next_update",
      submittedBy: USER_A,
    });
    await seedPackMod(ctx, first, {
      curseforgeProjectId: suggestion.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: suggestion.id,
      addedBy: null,
    });
    const adminAdd = await seedPackMod(ctx, first);

    const rows = await modpackService.getPackMods(modpack.id);

    expect(
      rows.find(
        (row) => row.curseforgeProjectId === suggestion.curseforgeProjectId,
      ),
    ).toMatchObject({
      suggestionWorkshopId: second.id,
      suggestionWorkshopName: "Vitest QoL Round",
    });
    expect(
      rows.find(
        (row) => row.curseforgeProjectId === adminAdd.curseforgeProjectId,
      ),
    ).toMatchObject({
      suggestionWorkshopId: null,
      suggestionWorkshopName: null,
    });
  });
});

describe("ModpackService release history", () => {
  it("freezes each mod's file when a published pack is read", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5001 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: fileIdFor(member.curseforgeProjectId),
        projectId: member.curseforgeProjectId,
        displayName: "Cool Mod 1.2.3",
        fileName: "coolmod-1.2.3.jar",
        fileDate: "2026-01-01T00:00:00.000Z",
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.236",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    expect(release).toMatchObject({
      version: "1.0.0",
      minecraftVersion: "1.21.1",
      modLoader: "neoforge-21.1.236",
      modCount: 1,
    });
    const rows = await Q.modpack.release.mod.listForReleases([release.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      curseforgeProjectId: member.curseforgeProjectId,
      fileId: fileIdFor(member.curseforgeProjectId),
      fileName: "coolmod-1.2.3.jar",
    });
  });

  it("exposes a release's frozen membership", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5010 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: fileIdFor(member.curseforgeProjectId),
        projectId: member.curseforgeProjectId,
        displayName: "Cool Mod 1.2.3",
        fileName: "coolmod-1.2.3.jar",
        fileDate: "2026-01-01T00:00:00.000Z",
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );
    await modpackService.reconcile(modpack.id);
    const [release] = await modpackService.listReleases(modpack.id);

    const rows = await modpackService.getReleaseMods(release.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      curseforgeProjectId: member.curseforgeProjectId,
      fileId: fileIdFor(member.curseforgeProjectId),
      fileName: "coolmod-1.2.3.jar",
      projectName: `Vitest Mod ${member.curseforgeProjectId}`,
    });
    expect(rows[0]).not.toHaveProperty("releaseId");
  });

  it("rejects an unknown release", async () => {
    await expect(modpackService.getReleaseMods(999_999_999)).rejects.toThrow(
      "not found",
    );
  });

  it("records a published file only once across repeated reconciles", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5002 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const published = manifest({
      version: "1.0.0",
      modIds: new Set([member.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(published);

    await modpackService.reconcile(modpack.id);
    await modpackService.reconcile(modpack.id);

    expect(await modpackService.listReleases(modpack.id)).toHaveLength(1);
  });

  it("treats a release recorded under its server pack file as already read", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const modIds = new Set([member.curseforgeProjectId]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "1.0.0", fileId: 9100, modIds }),
    );
    await modpackService.reconcile(modpack.id);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        fileId: 9000,
        serverPackFileId: 9100,
        modIds,
      }),
    );
    await modpackService.reconcile(modpack.id);

    const releases = await modpackService.listReleases(modpack.id);
    expect(releases).toHaveLength(1);
    expect(releases[0].curseforgeFileId).toBe(9100);
  });

  it("keeps an older release readable after a newer one lands", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5003 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const kept = await seedPackMod(ctx, workshop);
    const dropped = await seedPackMod(ctx, workshop);
    const arrival = await seedProject(ctx, "Arrival");

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([
          kept.curseforgeProjectId,
          dropped.curseforgeProjectId,
        ]),
      }),
    );
    await modpackService.reconcile(modpack.id);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.1.0",
        modIds: new Set([kept.curseforgeProjectId, arrival]),
        entries: [
          { projectId: kept.curseforgeProjectId, fileId: 777 },
          { projectId: arrival, fileId: 888 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const releases = await modpackService.listReleases(modpack.id);
    expect(releases.map((r) => r.version)).toEqual(["1.1.0", "1.0.0"]);

    const old = releases[1];
    const oldRows = await Q.modpack.release.mod.listForReleases([old.id]);
    expect(oldRows.map((row) => row.curseforgeProjectId).sort()).toEqual(
      [kept.curseforgeProjectId, dropped.curseforgeProjectId].sort(),
    );
    expect(
      oldRows.find(
        (row) => row.curseforgeProjectId === kept.curseforgeProjectId,
      )?.fileId,
    ).toBe(fileIdFor(kept.curseforgeProjectId));
  });

  it("diffs a release against the one before it", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5004 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const kept = await seedPackMod(ctx, workshop);
    const bumped = await seedPackMod(ctx, workshop);
    const dropped = await seedPackMod(ctx, workshop);
    const arrival = await seedProject(ctx, "Arrival");

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([
          kept.curseforgeProjectId,
          bumped.curseforgeProjectId,
          dropped.curseforgeProjectId,
        ]),
      }),
    );
    await modpackService.reconcile(modpack.id);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.1.0",
        modIds: new Set([
          kept.curseforgeProjectId,
          bumped.curseforgeProjectId,
          arrival,
        ]),
        entries: [
          {
            projectId: kept.curseforgeProjectId,
            fileId: fileIdFor(kept.curseforgeProjectId),
          },
          { projectId: bumped.curseforgeProjectId, fileId: 999_001 },
          { projectId: arrival, fileId: 999_002 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [latest] = await modpackService.listReleases(modpack.id);
    const diff = await modpackService.getReleaseDiff(latest.id);

    expect(diff.previous?.version).toBe("1.0.0");
    expect(diff.added.map((e) => e.curseforgeProjectId)).toEqual([arrival]);
    expect(diff.updated.map((e) => e.curseforgeProjectId)).toEqual([
      bumped.curseforgeProjectId,
    ]);
    expect(diff.updated[0].previousFile?.fileId).toBe(
      fileIdFor(bumped.curseforgeProjectId),
    );
    expect(diff.removed.map((e) => e.curseforgeProjectId)).toEqual([
      dropped.curseforgeProjectId,
    ]);
    expect(diff.unchanged).toBe(1);
  });

  it("treats the first recorded release as a baseline, not an all-added diff", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5005 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    const diff = await modpackService.getReleaseDiff(release.id);

    expect(diff.previous).toBeNull();
    expect(diff.added).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });

  it("points current membership at the newest published file", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5006 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      fileId: 1,
      fileName: "old.jar",
    });
    vi.mocked(getFilesDetails).mockResolvedValue([
      {
        fileId: 4242,
        projectId: member.curseforgeProjectId,
        displayName: "New 2.0",
        fileName: "new-2.0.jar",
        fileDate: null,
        releaseType: 1,
      },
    ]);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "2.0.0",
        modIds: new Set([member.curseforgeProjectId]),
        entries: [{ projectId: member.curseforgeProjectId, fileId: 4242 }],
      }),
    );

    await modpackService.reconcile(modpack.id);

    expect(await Q.modpack.mod.get({ id: member.id })).toMatchObject({
      fileId: 4242,
      fileName: "new-2.0.jar",
    });
  });
});

describe("ModpackService release diff with multi-file mods", () => {
  it("counts a project shipping several files once, and only as changed when its files change", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5007 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const twin = await seedPackMod(ctx, workshop);
    const solo = await seedPackMod(ctx, workshop);

    const twinEntries = [
      { projectId: twin.curseforgeProjectId, fileId: 610_001 },
      { projectId: twin.curseforgeProjectId, fileId: 610_002 },
    ];
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([twin.curseforgeProjectId, solo.curseforgeProjectId]),
        entries: [
          ...twinEntries,
          { projectId: solo.curseforgeProjectId, fileId: 610_003 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [first] = await modpackService.listReleases(modpack.id);
    expect(first.modCount).toBe(2);
    expect(
      await Q.modpack.release.mod.listForReleases([first.id]),
    ).toHaveLength(3);

    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.1.0",
        modIds: new Set([twin.curseforgeProjectId, solo.curseforgeProjectId]),
        entries: [
          ...twinEntries,
          { projectId: solo.curseforgeProjectId, fileId: 610_099 },
        ],
      }),
    );
    await modpackService.reconcile(modpack.id);

    const [latest] = await modpackService.listReleases(modpack.id);
    const diff = await modpackService.getReleaseDiff(latest.id);

    expect(diff.updated.map((e) => e.curseforgeProjectId)).toEqual([
      solo.curseforgeProjectId,
    ]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });
});

describe("ModpackService.recordRelease durability", () => {
  it("leaves no release behind when the membership write fails", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5008 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const good = await seedPackMod(ctx, workshop);
    const bad = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([good.curseforgeProjectId, bad.curseforgeProjectId]),
        entries: [
          { projectId: good.curseforgeProjectId, fileId: 630_001 },
          // out of int4 range, so the membership insert dies mid-transaction
          { projectId: bad.curseforgeProjectId, fileId: 9_999_999_999 },
        ],
      }),
    );

    await expect(modpackService.reconcile(modpack.id)).rejects.toThrow();

    expect(await modpackService.listReleases(modpack.id)).toHaveLength(0);
  });

  it("tolerates a manifest repeating the same project and file", async () => {
    const modpack = await seedModpack(ctx, { curseforgeProjectId: 5009 });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
        entries: [
          { projectId: member.curseforgeProjectId, fileId: 620_001 },
          { projectId: member.curseforgeProjectId, fileId: 620_001 },
        ],
      }),
    );

    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    expect(release.modCount).toBe(1);
    expect(
      await Q.modpack.release.mod.listForReleases([release.id]),
    ).toHaveLength(1);
  });
});

describe("ModpackService.deleteModpack", () => {
  it("throws NotFoundError for a modpack that does not exist", async () => {
    await expect(modpackService.deleteModpack(99_999_999)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("refuses while any workshop uses it, archived included", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });

    await expect(
      modpackService.deleteModpack(workshop.modpackId),
    ).rejects.toThrow(ConflictError);

    expect(await Q.modpack.find({ id: workshop.modpackId })).not.toBeNull();
  });

  it("deletes members and releases once no workshop uses it", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const member = await seedPackMod(ctx, workshop);
    const release = await Q.modpack.release.createAndReturn({
      modpackId: workshop.modpackId,
      curseforgeFileId: 640_001,
      modCount: 1,
    });

    await workshopService.deleteWorkshop(workshop.id);
    await modpackService.deleteModpack(workshop.modpackId);

    expect(await Q.modpack.find({ id: workshop.modpackId })).toBeNull();
    expect(await Q.modpack.mod.find({ id: member.id })).toBeNull();
    expect(await Q.modpack.release.find({ id: release.id })).toBeNull();
  });
});

function cfFile(
  overrides: Partial<ModpackFile> & { id: number; projectId: number },
): ModpackFile {
  return {
    displayName: null,
    fileDate: null,
    fileStatus: null,
    isAvailable: true,
    serverPackFileId: null,
    alternateFileId: null,
    parentProjectFileId: null,
    isServerPack: false,
    ...overrides,
  };
}

describe("ModpackService.reconcile for a pack that ships a server pack", () => {
  it("refuses a client-only read and leaves members and suggestions untouched", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
      shipsServerPack: true,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "in_pack",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "2.0.0", modIds: new Set<number>() }),
    );

    await expect(modpackService.reconcile(modpack.id)).rejects.toThrow(
      BadRequestError,
    );

    expect(await Q.modpack.mod.get({ id: member.id })).toMatchObject({
      droppedFromManifestAt: null,
      liveInVersion: "1.0.0",
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "in_pack",
    });
    expect(await modEvents(mod.id)).toEqual([]);
    expect(announcePackDropOut).not.toHaveBeenCalled();
    expect(await modpackService.listReleases(modpack.id)).toEqual([]);
  });

  it("keeps reconciling a client-only pack and flips the flag once a server pack is read", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({
        version: "1.0.0",
        modIds: new Set([member.curseforgeProjectId]),
      }),
    );

    await modpackService.reconcile(modpack.id);
    expect(await Q.modpack.get({ id: modpack.id })).toMatchObject({
      shipsServerPack: false,
    });

    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[member.curseforgeProjectId, "both"]]),
    );
    await modpackService.reconcile(modpack.id);
    expect(await Q.modpack.get({ id: modpack.id })).toMatchObject({
      shipsServerPack: true,
    });
  });
});

describe("ModpackService.recordPublish", () => {
  const CLIENT = 8_710_127;
  const SERVER = 8_710_134;

  function serveReportedPair(projectId: number) {
    vi.mocked(getModpackFile).mockImplementation(async (_project, fileId) =>
      fileId === CLIENT
        ? cfFile({ id: CLIENT, projectId })
        : fileId === SERVER
          ? cfFile({ id: SERVER, projectId, parentProjectFileId: CLIENT })
          : null,
    );
  }

  it("stores the reported pair, forces a reconcile and ships a server-only suggestion", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const serverOnly = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue({
      ...sidedManifest("0.6.3", [[serverOnly.curseforgeProjectId, "server"]]),
      fileId: CLIENT,
      serverPackFileId: SERVER,
    });

    const result = await modpackService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(result).toMatchObject({ ingested: true, error: null });
    expect(getModpackManifest).toHaveBeenCalledWith(projectId, {
      force: true,
    });
    const publish = await Q.modpack.publish.get({
      modpackId: modpack.id,
      clientFileId: CLIENT,
    });
    expect(publish).toMatchObject({
      serverPackFileId: SERVER,
      lastError: null,
    });
    expect(publish.ingestedAt).not.toBeNull();
    expect(await Q.modpack.get({ id: modpack.id })).toMatchObject({
      shipsServerPack: true,
    });
    expect(await Q.workshop.mod.get({ id: serverOnly.id })).toMatchObject({
      status: "in_pack",
    });
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: serverOnly.curseforgeProjectId,
      }),
    ).toMatchObject({
      origin: "suggestion",
      workshopModId: serverOnly.id,
      liveInVersion: "0.6.3",
    });
    const [release] = await modpackService.listReleases(modpack.id);
    expect(release).toMatchObject({
      curseforgeFileId: CLIENT,
      serverPackFileId: SERVER,
      modCount: 1,
    });
  });

  it("is idempotent per client file and refreshes the report on a resend", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue({
      ...manifest({ version: "0.6.3" }),
      fileId: CLIENT,
      serverPackFileId: SERVER,
    });

    await modpackService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });
    await modpackService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(await Q.modpack.publish.count({ modpackId: modpack.id })).toBe(1);
  });

  it("comes back not ingested with the reason when CurseForge lists a newer file than the reported one", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue({
      ...manifest({ version: "0.6.4" }),
      fileId: CLIENT + 10,
      serverPackFileId: SERVER + 10,
    });

    const result = await modpackService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(result.ingested).toBe(false);
    expect(result.error).toContain(`file ${CLIENT + 10} as newer`);
    const publish = await Q.modpack.publish.get({
      modpackId: modpack.id,
      clientFileId: CLIENT,
    });
    expect(publish.ingestedAt).toBeNull();
    expect(publish.lastError).toContain(`file ${CLIENT + 10} as newer`);
  });

  it("keeps the report and returns the refusal when the forced reconcile is refused", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "0.6.3", fileId: CLIENT }),
    );

    const result = await modpackService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(result.ingested).toBe(false);
    expect(result.error).toContain("without a server pack");
    const publish = await Q.modpack.publish.get({
      modpackId: modpack.id,
      clientFileId: CLIENT,
    });
    expect(publish.ingestedAt).toBeNull();
    expect(publish.lastError).toContain("without a server pack");
  });

  it("refuses a server pack that is not an additional file of the client file", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    vi.mocked(getModpackFile).mockImplementation(async (_project, fileId) =>
      cfFile({
        id: fileId,
        projectId,
        parentProjectFileId: fileId === SERVER ? CLIENT - 1 : null,
      }),
    );

    await expect(
      modpackService.recordPublish({
        projectId,
        clientFileId: CLIENT,
        serverPackFileId: SERVER,
      }),
    ).rejects.toThrow(BadRequestError);

    expect(await Q.modpack.publish.count({ modpackId: modpack.id })).toBe(0);
    expect(getModpackManifest).not.toHaveBeenCalled();
  });

  it("refuses files CurseForge does not serve yet", async () => {
    const projectId = ctx.nextProjectId++;
    await seedModpack(ctx, { curseforgeProjectId: projectId });
    vi.mocked(getModpackFile).mockImplementation(async (_project, fileId) =>
      fileId === CLIENT ? cfFile({ id: CLIENT, projectId }) : null,
    );

    await expect(
      modpackService.recordPublish({
        projectId,
        clientFileId: CLIENT,
        serverPackFileId: SERVER,
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("throws NotFoundError when no modpack follows the project", async () => {
    await expect(
      modpackService.recordPublish({
        projectId: 1,
        clientFileId: CLIENT,
        serverPackFileId: SERVER,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ModpackService.recordRelease upgrade", () => {
  it("re-freezes a release recorded from the client file alone once the server pack is read, never the other way", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const shared = await seedPackMod(ctx, workshop);
    const serverOnly = await seedPackMod(ctx, workshop);
    const clientOnly = manifest({
      version: "0.6.3",
      modIds: new Set([shared.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(clientOnly);

    await modpackService.reconcile(modpack.id);
    const [frozen] = await modpackService.listReleases(modpack.id);
    expect(frozen).toMatchObject({ modCount: 1, serverPackFileId: null });

    vi.mocked(getModpackManifest).mockResolvedValue({
      ...sidedManifest("0.6.3", [
        [shared.curseforgeProjectId, "both"],
        [serverOnly.curseforgeProjectId, "server"],
      ]),
      fileId: clientOnly.fileId,
      serverPackFileId: 900_001,
    });
    await modpackService.reconcile(modpack.id);

    const releases = await modpackService.listReleases(modpack.id);
    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({
      id: frozen.id,
      modCount: 2,
      serverPackFileId: 900_001,
    });
    expect(
      await Q.modpack.release.mod.listForReleases([frozen.id]),
    ).toHaveLength(2);

    vi.mocked(getModpackManifest).mockResolvedValue(clientOnly);
    await expect(modpackService.reconcile(modpack.id)).rejects.toThrow(
      BadRequestError,
    );
    expect((await modpackService.listReleases(modpack.id))[0]).toMatchObject({
      modCount: 2,
      serverPackFileId: 900_001,
    });
  });
});

describe("ModpackService release changelog announcements", () => {
  it("starts an announcement once a release is read with its server pack, then only resumes", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    vi.mocked(getModpackManifest).mockResolvedValue(
      sidedManifest("2.0.0", [[member.curseforgeProjectId, "both"]]),
    );

    await modpackService.reconcile(modpack.id);
    const [release] = await modpackService.listReleases(modpack.id);
    expect(release.announcement).toBeNull();
    expect(announceReleaseChangelog).toHaveBeenCalledTimes(1);
    expect(announceReleaseChangelog).toHaveBeenLastCalledWith(
      expect.objectContaining({ releaseId: release.id, start: true }),
    );

    await modpackService.reconcile(modpack.id);
    expect(announceReleaseChangelog).toHaveBeenCalledTimes(2);
    expect(announceReleaseChangelog).toHaveBeenLastCalledWith(
      expect.objectContaining({ releaseId: release.id, start: false }),
    );
  });

  it("never announces a client-only read and starts once the server pack arrives", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop);
    const clientOnly = manifest({
      version: "1.0.0",
      modIds: new Set([member.curseforgeProjectId]),
    });
    vi.mocked(getModpackManifest).mockResolvedValue(clientOnly);

    await modpackService.reconcile(modpack.id);
    await modpackService.reconcile(modpack.id);
    expect(announceReleaseChangelog).not.toHaveBeenCalled();

    vi.mocked(getModpackManifest).mockResolvedValue({
      ...sidedManifest("1.0.0", [[member.curseforgeProjectId, "both"]]),
      fileId: clientOnly.fileId,
    });
    await modpackService.reconcile(modpack.id);

    const [release] = await modpackService.listReleases(modpack.id);
    expect(release.serverPackFileId).not.toBeNull();
    expect(announceReleaseChangelog).toHaveBeenCalledTimes(1);
    expect(announceReleaseChangelog).toHaveBeenLastCalledWith(
      expect.objectContaining({ releaseId: release.id, start: true }),
    );
  });
});
