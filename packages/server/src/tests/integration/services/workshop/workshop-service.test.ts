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
    getModpackModIds: vi.fn(async () => new Set<number>()),
    searchMods: vi.fn(async () => []),
    getFilesDependencies: vi.fn(async () => []),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

import pool, { Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { workshopService } from "@/services/workshop";
import { ingestProject } from "@/services/curseforge/ingest";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedProject,
  seedMod,
  seedPackMod,
  seedRequiredDependency,
  makeProjectData,
} from "@/tests/helpers/workshop";

const ADMIN = "999900000000000001";
const USER_A = "999900000000000002";
const USER_B = "999900000000000003";

const ctx = createWorkshopTestContext(990_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
  vi.mocked(ingestProject).mockImplementation(async (projectId: number) => ({
    entity: await Q.curseforge.project.get({ id: projectId }),
    data: makeProjectData(projectId),
  }));
});

afterEach(async () => {
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("WorkshopService.reviewMod", () => {
  it("throws BadRequestError when rejecting without a reason", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await expect(
      workshopService.reviewMod(mod.id, "reject", ADMIN),
    ).rejects.toThrow(BadRequestError);

    const unchanged = await Q.workshop.mod.get({ id: mod.id });
    expect(unchanged.status).toBe("pending");
  });

  it("sets status, reason, trimmed note, and reviewer on reject", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    const updated = await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
      note: "  crashes with create  ",
    });

    expect(updated.status).toBe("rejected");
    expect(updated.rejectReason).toBe("incompatible");
    expect(updated.rejectNote).toBe("crashes with create");
    expect(updated.reviewedBy).toBe(ADMIN);
    expect(updated.reviewedAt).toBeInstanceOf(Date);

    const persisted = await Q.workshop.mod.get({ id: mod.id });
    expect(persisted.status).toBe("rejected");
  });

  it("re-reviews a rejected mod to approved and clears reject fields", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "on_hold",
      note: "maybe next season",
    });
    const approved = await workshopService.reviewMod(mod.id, "approve", ADMIN);

    expect(approved.status).toBe("approved");
    expect(approved.rejectReason).toBeNull();
    expect(approved.rejectNote).toBeNull();
    expect(approved.reviewedBy).toBe(ADMIN);
  });

  it("removes the pack row and prunes orphaned dependencies when rejecting a previously approved mod", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const packRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      addedBy: null,
    });
    const depProjectId = await seedProject(ctx);
    const depRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      origin: "dependency",
    });
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "not_a_good_fit",
    });

    expect(await Q.modpack.mod.find({ id: packRow.id })).toBeNull();
    expect(await Q.modpack.mod.find({ id: depRow.id })).toBeNull();
    const rejected = await Q.workshop.mod.get({ id: mod.id });
    expect(rejected.status).toBe("rejected");
  });

  it("creates a linked modpack row on approve", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    const row = await Q.modpack.mod.find({
      modpackId: workshop.modpackId,
      curseforgeProjectId: mod.curseforgeProjectId,
    });
    expect(row).not.toBeNull();
    expect(row!.origin).toBe("suggestion");
    expect(row!.workshopModId).toBe(mod.id);
    expect(row!.liveAt).toBeNull();
  });

  it("claims an existing import row on approve, keeping its live state", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "import",
      addedBy: null,
      liveAt: new Date(),
      liveInVersion: "1.2.0",
    });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    const row = await Q.modpack.mod.get({
      modpackId: workshop.modpackId,
      curseforgeProjectId: mod.curseforgeProjectId,
    });
    expect(row.origin).toBe("suggestion");
    expect(row.workshopModId).toBe(mod.id);
    expect(row.liveInVersion).toBe("1.2.0");
  });
});

describe("WorkshopService.updateWorkshop", () => {
  it("rejects illegal status transitions", async () => {
    const workshop = await seedWorkshop(ctx, { status: "draft" });

    for (const status of ["closed", "archived"] as const) {
      await expect(
        workshopService.updateWorkshop(workshop.id, { status }),
      ).rejects.toThrow(`A draft workshop cannot move to ${status}`);
    }

    const unchanged = await Q.workshop.get({ id: workshop.id });
    expect(unchanged.status).toBe("draft");
  });

  it("applies legal transitions along the lifecycle", async () => {
    const workshop = await seedWorkshop(ctx, { status: "draft" });

    for (const status of [
      "open",
      "closed",
      "open",
      "closed",
      "archived",
      "closed",
    ] as const) {
      const updated = await workshopService.updateWorkshop(workshop.id, {
        status,
      });
      expect(updated.status).toBe(status);
    }
  });

  it("blocks reopening an archived workshop directly", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });

    for (const status of ["draft", "open"] as const) {
      await expect(
        workshopService.updateWorkshop(workshop.id, { status }),
      ).rejects.toThrow(BadRequestError);
    }
  });
});

describe("WorkshopService.suggestMod", () => {
  it("creates a pending suggestion with the snapshot file", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
      note: "please add",
    });

    expect(item.status).toBe("pending");
    expect(item.submittedBy).toBe(USER_A);
    expect(item.note).toBe("please add");
    expect(item.fileId).toBe(projectId + 1);
    expect(item.project.id).toBe(projectId);
  });

  it("counts only pending suggestions against the cap", async () => {
    const workshop = await seedWorkshop(ctx, { maxModsPerUser: 2 });
    await seedMod(ctx, workshop, { submittedBy: USER_A, status: "approved" });
    await seedMod(ctx, workshop, { submittedBy: USER_A, status: "approved" });
    await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
    });
    const projectId = await seedProject(ctx);

    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
    });

    expect(item.status).toBe("pending");
  });

  it("enforces the cap once pending suggestions reach the limit", async () => {
    const workshop = await seedWorkshop(ctx, { maxModsPerUser: 2 });
    await seedMod(ctx, workshop, { submittedBy: USER_A });
    await seedMod(ctx, workshop, { submittedBy: USER_A });
    const projectId = await seedProject(ctx);

    await expect(
      workshopService.suggestMod(workshop.id, USER_A, { projectId }),
    ).rejects.toThrow(
      "You already have 2 pending suggestions in this workshop, remove one or wait for a review",
    );
  });

  it("blocks resuggesting a rejected project with a rejected message", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx, "Create Stuff");
    await seedMod(ctx, workshop, {
      curseforgeProjectId: projectId,
      submittedBy: USER_B,
      status: "rejected",
      rejectReason: "incompatible",
    });

    const attempt = workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
    });

    await expect(attempt).rejects.toBeInstanceOf(BadRequestError);
    await expect(attempt).rejects.toThrow(
      "Rejected in this workshop: Create Stuff",
    );
  });

  it("blocks resuggesting a pending project with a conflict", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx, "Sophisticated Storage");
    await seedMod(ctx, workshop, {
      curseforgeProjectId: projectId,
      submittedBy: USER_B,
    });

    const attempt = workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
    });

    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
    await expect(attempt).rejects.toThrow(
      "Already suggested in this workshop: Sophisticated Storage",
    );
  });

  it("throws when the workshop is not open", async () => {
    const workshop = await seedWorkshop(ctx, { status: "closed" });
    const projectId = await seedProject(ctx);

    await expect(
      workshopService.suggestMod(workshop.id, USER_A, { projectId }),
    ).rejects.toThrow("This workshop is not open for suggestions");
  });
});

describe("WorkshopService.toggleModUpvote", () => {
  it("blocks self-upvotes", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await expect(
      workshopService.toggleModUpvote(mod.id, USER_A),
    ).rejects.toThrow("You cannot upvote your own suggestion");
  });

  it("enforces the budget on pending mods", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, workshop, { submittedBy: USER_B });
    const second = await seedMod(ctx, workshop, { submittedBy: USER_B });

    const result = await workshopService.toggleModUpvote(first.id, USER_A);
    expect(result).toEqual({
      upvoted: true,
      upvoteCount: 1,
      votesRemaining: 0,
    });

    await expect(
      workshopService.toggleModUpvote(second.id, USER_A),
    ).rejects.toThrow(
      "You have used all 1 of your votes, remove one or wait for a review",
    );
  });

  it("allows a free like on an approved mod at zero budget", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_B });
    const approved = await seedMod(ctx, workshop, {
      submittedBy: USER_B,
      status: "approved",
    });
    await workshopService.toggleModUpvote(pending.id, USER_A);

    const result = await workshopService.toggleModUpvote(approved.id, USER_A);

    expect(result.upvoted).toBe(true);
    expect(result.upvoteCount).toBe(1);
    expect(result.votesRemaining).toBe(0);
  });

  it("refunds the budget when toggling off", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, workshop, { submittedBy: USER_B });
    const second = await seedMod(ctx, workshop, { submittedBy: USER_B });
    await workshopService.toggleModUpvote(first.id, USER_A);

    const off = await workshopService.toggleModUpvote(first.id, USER_A);
    expect(off).toEqual({ upvoted: false, upvoteCount: 0, votesRemaining: 1 });

    const result = await workshopService.toggleModUpvote(second.id, USER_A);
    expect(result.upvoted).toBe(true);
  });

  it("refunds the budget when an upvoted mod is reviewed", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, workshop, { submittedBy: USER_B });
    const second = await seedMod(ctx, workshop, { submittedBy: USER_B });
    await workshopService.toggleModUpvote(first.id, USER_A);

    await workshopService.reviewMod(first.id, "approve", ADMIN);

    const result = await workshopService.toggleModUpvote(second.id, USER_A);
    expect(result.upvoted).toBe(true);
    expect(result.votesRemaining).toBe(0);
  });

  it("throws NotFoundError for rejected mods", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_B,
      status: "rejected",
      rejectReason: "on_hold",
    });

    await expect(
      workshopService.toggleModUpvote(mod.id, USER_A),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkshopService.addModsAsAdmin", () => {
  it("creates admin-origin pack rows with the snapshot file", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectA = await seedProject(ctx);
    const projectB = await seedProject(ctx);

    const rows = await workshopService.addModsAsAdmin(
      workshop.id,
      [projectA, projectB],
      ADMIN,
    );

    expect(rows).toHaveLength(2);
    const rowA = rows.find((row) => row.curseforgeProjectId === projectA);
    expect(rowA).toMatchObject({
      origin: "admin",
      addedBy: ADMIN,
      workshopModId: null,
      fileId: projectA + 1,
    });
    expect(rowA!.project.id).toBe(projectA);
  });

  it("rejects the whole batch when a project is already in the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const existing = await seedPackMod(ctx, workshop);
    const fresh = await seedProject(ctx);

    await expect(
      workshopService.addModsAsAdmin(
        workshop.id,
        [existing.curseforgeProjectId, fresh],
        ADMIN,
      ),
    ).rejects.toThrow(ConflictError);

    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      1,
    );
  });

  it("throws on an archived workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const projectId = await seedProject(ctx);

    await expect(
      workshopService.addModsAsAdmin(workshop.id, [projectId], ADMIN),
    ).rejects.toThrow("Cannot add mods to an archived workshop");
  });
});

describe("WorkshopService.getDependencyReport", () => {
  it("lists dependency-origin rows as pulled and aggregates optional deps", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop, { addedBy: ADMIN });
    const depProjectId = await seedProject(ctx);
    const depRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: depProjectId,
      origin: "dependency",
      addedBy: ADMIN,
    });
    await seedRequiredDependency(
      workshop,
      member.curseforgeProjectId,
      depProjectId,
    );
    const optionalProjectId = await seedProject(ctx, "Vitest Optional");
    await Q.workshop.project.dependency.create({
      workshopId: workshop.id,
      curseforgeProjectId: member.curseforgeProjectId,
      dependsOnProjectId: optionalProjectId,
      relationType: 2,
    });

    const report = await workshopService.getDependencyReport(workshop.id);

    expect(report.pulled.map((row) => row.id)).toEqual([depRow.id]);
    expect(
      report.pulled[0].requiredBy.map((r) => r.curseforgeProjectId),
    ).toEqual([member.curseforgeProjectId]);
    expect(report.optional).toHaveLength(1);
    expect(report.optional[0]).toMatchObject({
      curseforgeProjectId: optionalProjectId,
      name: "Vitest Optional",
      rejected: false,
      inWorkshop: false,
    });
    expect(
      report.optional[0].wantedBy.map((w) => w.curseforgeProjectId),
    ).toEqual([member.curseforgeProjectId]);
  });

  it("flags optional deps that were rejected in the workshop", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop, { addedBy: ADMIN });
    const optionalProjectId = await seedProject(ctx);
    await Q.workshop.project.dependency.create({
      workshopId: workshop.id,
      curseforgeProjectId: member.curseforgeProjectId,
      dependsOnProjectId: optionalProjectId,
      relationType: 2,
    });
    await seedMod(ctx, workshop, {
      curseforgeProjectId: optionalProjectId,
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "incompatible",
    });

    const report = await workshopService.getDependencyReport(workshop.id);

    expect(report.optional).toHaveLength(1);
    expect(report.optional[0].rejected).toBe(true);
  });
});

describe("WorkshopService.getRejectedMods", () => {
  it("returns rejected rows for an open workshop", async () => {
    const workshop = await seedWorkshop(ctx);
    const rejected = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "covered_by_other_mod",
      reviewedBy: ADMIN,
      reviewedAt: new Date(),
    });
    await seedMod(ctx, workshop, { submittedBy: USER_B });

    const rows = await workshopService.getRejectedMods(workshop.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(rejected.id);
    expect(rows[0].rejectReason).toBe("covered_by_other_mod");
  });

  it("throws NotFoundError for a draft workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "draft" });

    await expect(workshopService.getRejectedMods(workshop.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("WorkshopService.getMySuggestions", () => {
  it("returns the caller's own user rows across statuses", async () => {
    const workshop = await seedWorkshop(ctx);
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const approved = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const rejected = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
    });
    await seedMod(ctx, workshop, { submittedBy: USER_B });

    const rows = await workshopService.getMySuggestions(workshop.id, USER_A);

    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [pending.id, approved.id, rejected.id].sort((a, b) => a - b),
    );
    expect(new Set(rows.map((row) => row.status))).toEqual(
      new Set(["pending", "approved", "rejected"]),
    );
  });
});

describe("WorkshopService.getMySuggestionHistory", () => {
  it("returns the caller's rows across visible workshops, newest first", async () => {
    const first = await seedWorkshop(ctx);
    const second = await seedWorkshop(ctx, { status: "closed" });
    const older = await seedMod(ctx, first, { submittedBy: USER_A });
    const newer = await seedMod(ctx, second, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "incompatible",
    });
    await seedMod(ctx, first, { submittedBy: USER_B });

    const rows = await workshopService.getMySuggestionHistory(USER_A);

    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect(rows[0]).toMatchObject({
      workshopName: second.name,
      workshopSlug: second.slug,
      status: "rejected",
    });
  });

  it("excludes suggestions in draft and archived workshops", async () => {
    const visible = await seedWorkshop(ctx);
    const draft = await seedWorkshop(ctx, { status: "draft" });
    const kept = await seedMod(ctx, visible, { submittedBy: USER_A });
    await seedMod(ctx, draft, { submittedBy: USER_A });

    const rows = await workshopService.getMySuggestionHistory(USER_A);

    expect(rows.map((row) => row.id)).toEqual([kept.id]);
  });
});

describe("WorkshopService.getPack", () => {
  it("returns the modpack with members and a null url when unpublished", async () => {
    const workshop = await seedWorkshop(ctx);
    const member = await seedPackMod(ctx, workshop);

    const pack = await workshopService.getPack(workshop.id);

    expect(pack.modpack).toEqual({
      name: "Vitest Modpack",
      description: null,
      curseforgeUrl: null,
    });
    expect(pack.mods.map((row) => row.id)).toEqual([member.id]);
    expect(pack.mods[0].project.id).toBe(member.curseforgeProjectId);
  });

  it("resolves the pack's CurseForge url from the cached project", async () => {
    const packProjectId = ctx.nextProjectId++;
    ctx.projectIds.push(packProjectId);
    await Q.curseforge.project.create({
      id: packProjectId,
      classId: 4471,
      slug: `vitest-pack-${packProjectId}`,
      name: "Vitest Pack",
      websiteUrl: "https://www.curseforge.com/minecraft/modpacks/vitest-pack",
    });
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: packProjectId,
    });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });

    const pack = await workshopService.getPack(workshop.id);

    expect(pack.modpack.curseforgeUrl).toBe(
      "https://www.curseforge.com/minecraft/modpacks/vitest-pack",
    );
  });

  it("hides packs of draft workshops from users but not admins", async () => {
    const workshop = await seedWorkshop(ctx, { status: "draft" });

    await expect(
      workshopService.getPack(workshop.id, { userVisible: true }),
    ).rejects.toThrow(NotFoundError);
    await expect(workshopService.getPack(workshop.id)).resolves.toMatchObject({
      mods: [],
    });
  });
});
