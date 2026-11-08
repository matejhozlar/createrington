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

vi.mock("@/services/curseforge/mods", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/mods")>();
  return {
    ...actual,
    getMod: vi.fn(async () => {
      throw new Error("getMod must not be called in this suite");
    }),
    getMods: vi.fn(async () => []),
    searchMods: vi.fn(async () => []),
  };
});
vi.mock("@/services/curseforge/files", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/files")>();
  return {
    ...actual,
    getFilesDependencies: vi.fn(async () => []),
    getFilesDetails: vi.fn(async () => []),
  };
});
vi.mock("@/services/curseforge/modpack", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/modpack")>();
  return { ...actual, getModpackFile: vi.fn(async () => null) };
});
vi.mock("@/services/curseforge/modpack-manifest", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/curseforge/modpack-manifest")
    >();
  return {
    ...actual,
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

vi.mock("@/services/launcher/pack/launcher-pack.service", () => ({
  launcherPackService: {
    prepareRelease: vi.fn(async () => undefined),
    prepareSnapshot: vi.fn(async () => undefined),
    checkReleases: vi.fn(async () => undefined),
  },
}));

vi.mock("@/services/launcher/pack/sandbox-files", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/launcher/pack/sandbox-files")
  >()),
  findSandboxFileUrls: vi.fn(async () => new Map()),
  findSandboxSnapshotUrl: vi.fn(async () => null),
}));

import pool, { Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { modpackAttentionService } from "@/services/modpack/attention.service";
import { getModpackManifest } from "@/services/curseforge/modpack-manifest";
import { announceReview } from "@/services/workshop/discord";
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
import { cleanupLauncherPacks } from "@/tests/helpers/launcher-pack";
import { manifest } from "@/tests/helpers/modpack";

const USER_A = "999900000000000002";
const ADMIN = "999900000000000001";

const ctx = createWorkshopTestContext(992_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
});

afterEach(async () => {
  await cleanupLauncherPacks(ctx);
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("ModpackAttentionService.getWorkshopAttention", () => {
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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

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

    const items = await modpackAttentionService.getWorkshopAttention(workshop);

    expect(
      items.filter((item) => item.type === "environment_unspecified"),
    ).toHaveLength(0);
  });
});

describe("ModpackAttentionService.removeDroppedMember", () => {
  it("removes a dropped suggestion member and rules its suggestion out", async () => {
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
      droppedFromManifestAt: new Date(),
    });

    const result = await modpackAttentionService.removeDroppedMember(
      workshop,
      member.id,
      ADMIN,
    );

    expect(result.member.id).toBe(member.id);
    expect(result.mod).toMatchObject({ id: mod.id, status: "rejected" });
    expect(await Q.modpack.mod.find({ id: member.id })).toBeNull();
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "rejected",
      rejectReason: null,
      rejectNote: null,
      reviewedBy: ADMIN,
      fileChosen: false,
    });
    expect(vi.mocked(announceReview)).toHaveBeenCalledWith(
      expect.objectContaining({ id: mod.id, status: "rejected" }),
      "rejected",
    );

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "rejected",
      workshopId: workshop.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      actorDiscordId: ADMIN,
      fromStatus: "next_update",
      toStatus: "rejected",
      rejectReason: null,
    });

    const items = await modpackAttentionService.getWorkshopAttention(workshop);
    expect(
      items.filter((item) => item.type === "dropped_from_pack"),
    ).toHaveLength(0);
  });

  it("rules out a sibling workshop's suggestion, which would ship the mod again", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const sibling = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, sibling, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      droppedFromManifestAt: new Date(),
    });

    await modpackAttentionService.removeDroppedMember(
      workshop,
      member.id,
      ADMIN,
    );

    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "rejected",
      reviewedBy: ADMIN,
    });
    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "rejected",
      workshopId: sibling.id,
    });
  });

  it("removes a dropped dependency member and prunes its stale edges", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      origin: "dependency",
      droppedFromManifestAt: new Date(),
    });
    const dependsOn = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      dependsOn,
    );

    const result = await modpackAttentionService.removeDroppedMember(
      workshop,
      member.id,
      ADMIN,
    );

    expect(result.mod).toBeNull();
    expect(await Q.modpack.mod.find({ id: member.id })).toBeNull();
    expect(vi.mocked(announceReview)).not.toHaveBeenCalled();
    expect(
      await Q.workshop.project.dependency.findAll({
        workshopId: workshop.id,
        curseforgeProjectId: member.curseforgeProjectId,
      }),
    ).toEqual([]);
  });

  it("leaves an already ruled-out suggestion as it is", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "incompatible",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      droppedFromManifestAt: new Date(),
    });
    const eventSpy = vi.spyOn(Q.workshop.mod.event, "create");

    try {
      await modpackAttentionService.removeDroppedMember(
        workshop,
        member.id,
        ADMIN,
      );

      expect(await Q.modpack.mod.find({ id: member.id })).toBeNull();
      expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
        status: "rejected",
        rejectReason: "incompatible",
      });
      expect(vi.mocked(announceReview)).not.toHaveBeenCalled();
      expect(eventSpy).not.toHaveBeenCalled();
    } finally {
      eventSpy.mockRestore();
    }
  });

  it("refuses a live member, an unknown one, and one from another pack", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const live = await seedPackMod(ctx, workshop, {
      origin: "dependency",
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const other = await seedWorkshop(ctx);
    const foreign = await seedPackMod(ctx, other, {
      origin: "dependency",
      droppedFromManifestAt: new Date(),
    });

    await expect(
      modpackAttentionService.removeDroppedMember(workshop, live.id, ADMIN),
    ).rejects.toThrow(BadRequestError);
    expect(await Q.modpack.mod.find({ id: live.id })).not.toBeNull();
    await expect(
      modpackAttentionService.removeDroppedMember(
        workshop,
        live.id + 1_000_000,
        ADMIN,
      ),
    ).rejects.toThrow(NotFoundError);
    await expect(
      modpackAttentionService.removeDroppedMember(workshop, foreign.id, ADMIN),
    ).rejects.toThrow(NotFoundError);
    expect(await Q.modpack.mod.find({ id: foreign.id })).not.toBeNull();
  });

  it("refuses archived workshops on either side", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const archived = await seedWorkshop(ctx, {
      modpackId: modpack.id,
      status: "archived",
    });
    const member = await seedPackMod(ctx, archived, {
      origin: "dependency",
      droppedFromManifestAt: new Date(),
    });
    await expect(
      modpackAttentionService.removeDroppedMember(archived, member.id, ADMIN),
    ).rejects.toThrow(BadRequestError);
    expect(await Q.modpack.mod.find({ id: member.id })).not.toBeNull();

    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, archived, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const linked = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      droppedFromManifestAt: new Date(),
    });
    await expect(
      modpackAttentionService.removeDroppedMember(workshop, linked.id, ADMIN),
    ).rejects.toThrow(BadRequestError);
    expect(await Q.modpack.mod.find({ id: linked.id })).not.toBeNull();
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "next_update",
    });
  });

  it("refuses when the member ships again between the read and the delete", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const member = await seedPackMod(ctx, workshop, {
      origin: "dependency",
      droppedFromManifestAt: new Date(),
    });
    const find = Q.modpack.mod.find.bind(Q.modpack.mod);
    const spy = vi
      .spyOn(Q.modpack.mod, "find")
      .mockImplementationOnce(async (filters) => {
        const row = await find(filters);
        await Q.modpack.mod.updateAll(
          { droppedFromManifestAt: null, liveAt: new Date() },
          { id: member.id },
        );
        return row;
      });

    try {
      await expect(
        modpackAttentionService.removeDroppedMember(workshop, member.id, ADMIN),
      ).rejects.toThrow(ConflictError);
    } finally {
      spy.mockRestore();
    }
    expect(await Q.modpack.mod.get({ id: member.id })).toMatchObject({
      droppedFromManifestAt: null,
    });
  });

  it("rolls the delete back when the suggestion was reviewed meanwhile", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: ctx.nextProjectId++,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      droppedFromManifestAt: new Date(),
    });
    const find = Q.workshop.mod.find.bind(Q.workshop.mod);
    const spy = vi
      .spyOn(Q.workshop.mod, "find")
      .mockImplementationOnce(async (filters) => {
        const row = await find(filters);
        await Q.workshop.mod.updateAll({ status: "testing" }, { id: mod.id });
        return row;
      });
    const eventSpy = vi.spyOn(Q.workshop.mod.event, "create");

    try {
      await expect(
        modpackAttentionService.removeDroppedMember(workshop, member.id, ADMIN),
      ).rejects.toThrow(ConflictError);
      expect(eventSpy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      eventSpy.mockRestore();
    }
    expect(await Q.modpack.mod.find({ id: member.id })).not.toBeNull();
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "testing",
    });
    expect(vi.mocked(announceReview)).not.toHaveBeenCalled();
  });
});
