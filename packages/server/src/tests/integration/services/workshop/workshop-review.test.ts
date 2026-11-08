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
vi.mock("@/services/curseforge/modpack-manifest", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/curseforge/modpack-manifest")
    >();
  return {
    ...actual,
    getModpackModIds: vi.fn(async () => new Set<number>()),
  };
});

vi.mock("@/services/curseforge/ingest", () => ({
  ingestProject: vi.fn(),
  ingestProjects: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

import pool, { Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { workshopReviewService } from "@/services/workshop/review.service";
import { CurseForgeClass } from "@/services/curseforge/client";
import {
  getFilesDependencies,
  getFilesDetails,
} from "@/services/curseforge/files";
import type { WorkshopModStatus } from "@createrington/shared/db";
import { ingestProject, ingestProjects } from "@/services/curseforge/ingest";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedWorkshop,
  seedProject,
  seedMod,
  seedPackMod,
  seedRequiredDependency,
  makeProjectData,
  mockNextIngestAs,
} from "@/tests/helpers/workshop";

const ADMIN = "999900000000000001";
const USER_A = "999900000000000002";

const ctx = createWorkshopTestContext(990_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
  vi.mocked(ingestProject).mockImplementation(async (projectId: number) => ({
    entity: await Q.curseforge.project.get({ id: projectId }),
    data: makeProjectData(projectId),
  }));
  vi.mocked(ingestProjects).mockImplementation(
    async (projectIds: number[]) =>
      new Map(projectIds.map((id) => [id, makeProjectData(id)])),
  );
});

afterEach(async () => {
  await cleanupWorkshopTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("WorkshopReviewService.reviewMod", () => {
  it("throws BadRequestError when rejecting without a reason", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await expect(
      workshopReviewService.reviewMod(mod.id, "reject", ADMIN),
    ).rejects.toThrow(BadRequestError);

    const unchanged = await Q.workshop.mod.get({ id: mod.id });
    expect(unchanged.status).toBe("pending");
  });

  it("sets status, reason, trimmed note, and reviewer on reject", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "reject",
      ADMIN,
      {
        reason: "incompatible",
        note: "  crashes with create  ",
      },
    );

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

    await workshopReviewService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "on_hold",
      note: "maybe next season",
    });
    const approved = await workshopReviewService.reviewMod(
      mod.id,
      "approve",
      ADMIN,
    );

    expect(approved.status).toBe("approved");
    expect(approved.rejectReason).toBeNull();
    expect(approved.rejectNote).toBeNull();
    expect(approved.reviewedBy).toBe(ADMIN);
  });

  it("drops a rejected mod's dependency edges without touching the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const depProjectId = await seedProject(ctx);
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      depProjectId,
    );

    await workshopReviewService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "not_a_good_fit",
    });

    const rejected = await Q.workshop.mod.get({ id: mod.id });
    expect(rejected.status).toBe("rejected");
    expect(
      await Q.workshop.project.dependency.count({ workshopId: workshop.id }),
    ).toBe(0);
  });

  it("walks a suggestion to next_update without ever creating a pack row", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    const approved = await workshopReviewService.reviewMod(
      mod.id,
      "approve",
      ADMIN,
    );
    expect(approved.status).toBe("approved");

    const testing = await workshopReviewService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
    );
    expect(testing.status).toBe("testing");

    await workshopReviewService.setProjectEnvironment(
      mod.curseforgeProjectId,
      "both",
    );
    const promoted = await workshopReviewService.reviewMod(
      mod.id,
      "approve",
      ADMIN,
    );
    expect(promoted.status).toBe("next_update");

    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      0,
    );
  });

  it("rejects skipping stages of the review pipeline", async () => {
    const workshop = await seedWorkshop(ctx);
    const pending = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const approved = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });

    await expect(
      workshopReviewService.reviewMod(pending.id, "start_testing", ADMIN),
    ).rejects.toThrow(BadRequestError);
    await expect(
      workshopReviewService.reviewMod(approved.id, "approve", ADMIN),
    ).resolves.toMatchObject({ status: "approved" });
    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: approved.curseforgeProjectId,
      }),
    ).toBeNull();
  });

  it("sends a mod back one stage at a time", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });

    const testing = await workshopReviewService.reviewMod(
      mod.id,
      "send_back",
      ADMIN,
    );
    expect(testing.status).toBe("testing");

    const approved = await workshopReviewService.reviewMod(
      mod.id,
      "send_back",
      ADMIN,
    );
    expect(approved.status).toBe("approved");
  });

  it("refuses to send back a mod that is already in the published pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "in_pack",
    });

    await expect(
      workshopReviewService.reviewMod(mod.id, "send_back", ADMIN),
    ).rejects.toThrow(BadRequestError);
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("in_pack");
  });

  it("refuses to review in an archived workshop, including the pack-row self-heal", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const promoted = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });

    await expect(
      workshopReviewService.reviewMod(promoted.id, "approve", ADMIN),
    ).rejects.toThrow("Cannot review mods in an archived workshop");

    expect(
      await Q.modpack.mod.find({
        modpackId: workshop.modpackId,
        curseforgeProjectId: promoted.curseforgeProjectId,
      }),
    ).toBeNull();
  });

  it("refuses to start testing from anywhere but approved", async () => {
    const workshop = await seedWorkshop(ctx);
    const promoted = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const packRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: promoted.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: promoted.id,
      addedBy: null,
    });

    await expect(
      workshopReviewService.reviewMod(promoted.id, "start_testing", ADMIN),
    ).rejects.toThrow(BadRequestError);

    expect((await Q.workshop.mod.get({ id: promoted.id })).status).toBe(
      "next_update",
    );
    expect(await Q.modpack.mod.find({ id: packRow.id })).not.toBeNull();
  });

  it("refuses to send back a mod that has not been approved yet", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await expect(
      workshopReviewService.reviewMod(mod.id, "send_back", ADMIN),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects from mid-pipeline stages without touching the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    for (const status of ["approved", "testing"] as const) {
      const mod = await seedMod(ctx, workshop, {
        submittedBy: USER_A,
        status,
      });

      const rejected = await workshopReviewService.reviewMod(
        mod.id,
        "reject",
        ADMIN,
        { reason: "incompatible" },
      );

      expect(rejected.status).toBe("rejected");
      expect(
        await Q.modpack.mod.find({
          modpackId: workshop.modpackId,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
      ).toBeNull();
    }
  });

  it("re-rejects an already rejected mod to change the reason", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
    });

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "reject",
      ADMIN,
      {
        reason: "not_a_good_fit",
        note: "covered by the base pack",
      },
    );

    expect(updated.status).toBe("rejected");
    expect(updated.rejectReason).toBe("not_a_good_fit");
    expect(updated.rejectNote).toBe("covered by the base pack");
  });

  it("refuses to reject a mod that is already in the published pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "in_pack",
    });
    const packRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });

    await expect(
      workshopReviewService.reviewMod(mod.id, "reject", ADMIN, {
        reason: "incompatible",
      }),
    ).rejects.toThrow(
      "This mod is live in the published pack, publish a release without it first",
    );

    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("in_pack");
    expect(await Q.modpack.mod.find({ id: packRow.id })).not.toBeNull();
  });

  it("treats approving a mod already in the pack as a no-op", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "in_pack",
    });

    const result = await workshopReviewService.reviewMod(
      mod.id,
      "approve",
      ADMIN,
    );

    expect(result.status).toBe("in_pack");
    const unchanged = await Q.workshop.mod.get({ id: mod.id });
    expect(unchanged.status).toBe("in_pack");
    expect(unchanged.reviewedBy).toBeNull();
  });
});

describe("WorkshopReviewService.reviewMod environment gate", () => {
  it("refuses to approve a testing mod whose environment is unspecified", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "testing",
    });

    await expect(
      workshopReviewService.reviewMod(mod.id, "approve", ADMIN),
    ).rejects.toThrow(
      "Flag whether this mod runs client or server side before approving it for the next update",
    );
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("testing");
  });

  it("approves a testing mod once its environment is flagged", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "testing",
    });
    await workshopReviewService.setProjectEnvironment(
      mod.curseforgeProjectId,
      "both",
    );

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "approve",
      ADMIN,
    );

    expect(updated.status).toBe("next_update");
  });

  it("still allows sending an unclassified mod back a stage", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "testing",
    });

    const sentBack = await workshopReviewService.reviewMod(
      mod.id,
      "send_back",
      ADMIN,
    );

    expect(sentBack.status).toBe("approved");
  });
});

describe("WorkshopReviewService.reviewMod ruled-out dependency gate", () => {
  it("refuses to start testing when a required dependency is ruled out", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const ruledOut = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      ruledOut.curseforgeProjectId,
    );

    await expect(
      workshopReviewService.reviewMod(mod.id, "start_testing", ADMIN),
    ).rejects.toThrow(
      "A required dependency of this mod has been ruled out for this workshop",
    );
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("approved");
  });

  it("allows starting testing when the ruled-out dependency is only optional", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const ruledOut = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    await Q.workshop.project.dependency.create({
      workshopId: workshop.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      dependsOnProjectId: ruledOut.curseforgeProjectId,
      relationType: 2,
    });

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
    );

    expect(updated.status).toBe("testing");
  });

  it("allows starting testing when the required dependency is merely in review", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const inReview = await seedMod(ctx, workshop, { submittedBy: USER_A });
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      inReview.curseforgeProjectId,
    );

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
    );

    expect(updated.status).toBe("testing");
  });

  it("still allows sending a mod back to testing past a ruled-out dependency", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    const ruledOut = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      ruledOut.curseforgeProjectId,
    );

    const sentBack = await workshopReviewService.reviewMod(
      mod.id,
      "send_back",
      ADMIN,
    );

    expect(sentBack.status).toBe("testing");
  });

  it("refuses to start testing when the dependency cache is empty and CurseForge is unreachable", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
      fileId: 12345,
    });
    vi.mocked(getFilesDependencies).mockRejectedValueOnce(
      new Error("CurseForge is down"),
    );

    await expect(
      workshopReviewService.reviewMod(mod.id, "start_testing", ADMIN),
    ).rejects.toThrow(
      "Could not check this mod's dependencies right now, please try again",
    );
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("approved");
  });

  it("starts testing after a live resolve finds no dependencies", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
      fileId: 12345,
    });

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
    );

    expect(updated.status).toBe("testing");
    expect(getFilesDependencies).toHaveBeenCalledWith([12345]);
  });

  it("does not block on a ruled-out suggestion that is already a pack member", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });
    const ruledOut = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "not_a_good_fit",
    });
    await seedPackMod(ctx, workshop, {
      curseforgeProjectId: ruledOut.curseforgeProjectId,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    await seedRequiredDependency(
      workshop,
      mod.curseforgeProjectId,
      ruledOut.curseforgeProjectId,
    );

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
    );

    expect(updated.status).toBe("testing");
  });

  it("restores a mod's dependency edges when it is un-rejected", async () => {
    const workshop = await seedWorkshop(ctx);
    const depProjectId = await seedProject(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
      fileId: 12345,
    });
    vi.mocked(getFilesDependencies).mockResolvedValueOnce([
      {
        fileId: 12345,
        modId: mod.curseforgeProjectId,
        dependencies: [{ modId: depProjectId, relationType: 3 }],
      },
    ]);

    await workshopReviewService.reviewMod(mod.id, "approve", ADMIN);

    await vi.waitFor(async () => {
      expect(
        await Q.workshop.project.dependency.findAll({
          workshopId: workshop.id,
          curseforgeProjectId: mod.curseforgeProjectId,
        }),
      ).toMatchObject([{ dependsOnProjectId: depProjectId, relationType: 3 }]);
    });
  });
});

describe("WorkshopReviewService.reviewMod allowedFrom", () => {
  const FROM_TESTING_STAGES: WorkshopModStatus[] = [
    "approved",
    "testing",
    "next_update",
  ];

  it("refuses to screen a pending mod", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { status: "pending" });

    await expect(
      workshopReviewService.reviewMod(mod.id, "approve", ADMIN, {
        allowedFrom: FROM_TESTING_STAGES,
      }),
    ).rejects.toThrow(BadRequestError);
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("pending");
  });

  it("refuses to un-reject a ruled-out mod", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      status: "rejected",
      rejectReason: "on_hold",
    });

    await expect(
      workshopReviewService.reviewMod(mod.id, "approve", ADMIN, {
        allowedFrom: FROM_TESTING_STAGES,
      }),
    ).rejects.toThrow(BadRequestError);
    expect((await Q.workshop.mod.get({ id: mod.id })).status).toBe("rejected");
  });

  it("still walks the allowed stages", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { status: "approved" });

    const updated = await workshopReviewService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
      { allowedFrom: FROM_TESTING_STAGES },
    );

    expect(updated.status).toBe("testing");
  });
});

describe("WorkshopReviewService.addModsAsAdmin", () => {
  it("creates approved suggestions credited to the admin, with no pack row yet", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectA = await seedProject(ctx);
    const projectB = await seedProject(ctx);

    const rows = await workshopReviewService.addModsAsAdmin(
      workshop.id,
      [projectA, projectB],
      ADMIN,
      "Team pick for the storage hall",
    );

    expect(rows).toHaveLength(2);
    const rowA = rows.find((row) => row.curseforgeProjectId === projectA);
    expect(rowA).toMatchObject({
      status: "approved",
      submittedBy: ADMIN,
      reviewedBy: ADMIN,
      note: "Team pick for the storage hall",
      upvoteCount: 1,
      fileId: projectA + 1,
    });
    expect(rowA!.project.id).toBe(projectA);
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      0,
    );
  });

  it("still has to walk testing before it is staged for the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);
    const [added] = await workshopReviewService.addModsAsAdmin(
      workshop.id,
      [projectId],
      ADMIN,
    );

    await workshopReviewService.reviewMod(added.id, "start_testing", ADMIN);
    await expect(
      workshopReviewService.reviewMod(added.id, "send_back", ADMIN),
    ).resolves.toMatchObject({ status: "approved" });

    await workshopReviewService.reviewMod(added.id, "start_testing", ADMIN);
    await workshopReviewService.setProjectEnvironment(projectId, "server");
    await expect(
      workshopReviewService.reviewMod(added.id, "approve", ADMIN),
    ).resolves.toMatchObject({ status: "next_update" });
  });

  it("rejects the whole batch when a project is already in the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    const existing = await seedPackMod(ctx, workshop);
    const fresh = await seedProject(ctx);

    await expect(
      workshopReviewService.addModsAsAdmin(
        workshop.id,
        [existing.curseforgeProjectId, fresh],
        ADMIN,
      ),
    ).rejects.toThrow(ConflictError);

    expect(await Q.workshop.mod.count({ workshopId: workshop.id })).toBe(0);
  });

  it("rejects a project a player already suggested", async () => {
    const workshop = await seedWorkshop(ctx);
    const suggested = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await expect(
      workshopReviewService.addModsAsAdmin(
        workshop.id,
        [suggested.curseforgeProjectId],
        ADMIN,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("throws on an archived workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const projectId = await seedProject(ctx);

    await expect(
      workshopReviewService.addModsAsAdmin(workshop.id, [projectId], ADMIN),
    ).rejects.toThrow("Cannot add mods to an archived workshop");
  });

  it("accepts a resource pack and snapshots its loaderless file", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx, "Vitest Resource Pack", {
      classId: CurseForgeClass.resourcePacks,
    });
    mockNextIngestAs(CurseForgeClass.resourcePacks);

    const [added] = await workshopReviewService.addModsAsAdmin(
      workshop.id,
      [projectId],
      ADMIN,
    );

    expect(added).toMatchObject({
      status: "approved",
      fileId: projectId + 1,
      fileName: `vitest-project-${projectId}.zip`,
    });
    expect(added.project.classId).toBe(CurseForgeClass.resourcePacks);
  });

  it("rejects a project class the workshop cannot take", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx, "Vitest Modpack Project", {
      classId: CurseForgeClass.modpacks,
    });
    mockNextIngestAs(CurseForgeClass.modpacks);

    await expect(
      workshopReviewService.addModsAsAdmin(workshop.id, [projectId], ADMIN),
    ).rejects.toThrow(BadRequestError);
    expect(ingestProjects).toHaveBeenCalledTimes(1);
    expect(await Q.workshop.mod.count({ workshopId: workshop.id })).toBe(0);
  });
});

describe("WorkshopReviewService.setProjectEnvironment", () => {
  it("stores an explicit side as a manual flag", async () => {
    const projectId = await seedProject(ctx);

    const updated = await workshopReviewService.setProjectEnvironment(
      projectId,
      "client",
    );

    expect(updated.environment).toBe("client");
    expect(updated.environmentSource).toBe("manual");
    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "client",
      environmentSource: "manual",
    });
  });

  it("clears the source when set back to unspecified", async () => {
    const projectId = await seedProject(ctx);
    await Q.curseforge.project.update(
      { id: projectId },
      { environment: "server", environmentSource: "manual" },
    );

    await workshopReviewService.setProjectEnvironment(projectId, "unspecified");

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "unspecified",
      environmentSource: null,
    });
  });

  it("throws NotFoundError for a project that is not cached", async () => {
    await expect(
      workshopReviewService.setProjectEnvironment(ctx.nextProjectId++, "both"),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkshopReviewService.setModRequired", () => {
  it("defaults to enabled and flips for a next_update mod", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    expect(mod.required).toBe(true);

    const disabled = await workshopReviewService.setModRequired(mod.id, false);
    expect(disabled).toMatchObject({ changed: true, mod: { required: false } });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      required: false,
      status: "next_update",
    });

    const repeated = await workshopReviewService.setModRequired(mod.id, false);
    expect(repeated).toMatchObject({
      changed: false,
      mod: { required: false },
    });

    const enabled = await workshopReviewService.setModRequired(mod.id, true);
    expect(enabled).toMatchObject({ changed: true, mod: { required: true } });
  });

  it("refuses mods outside next_update", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "testing",
    });

    await expect(
      workshopReviewService.setModRequired(mod.id, false),
    ).rejects.toThrow(/next update/);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      required: true,
    });
  });

  it("refuses mods in an archived workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });

    await expect(
      workshopReviewService.setModRequired(mod.id, false),
    ).rejects.toThrow(/archived/);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      required: true,
    });
  });

  it("throws NotFoundError for an unknown mod", async () => {
    await expect(
      workshopReviewService.setModRequired(999_999_999, false),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkshopReviewService.setModFile", () => {
  it("chooses, repeats as a no-op, and resets for a next_update mod", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    expect(mod.fileChosen).toBe(false);
    vi.mocked(getFilesDetails).mockResolvedValueOnce([
      {
        fileId: 555,
        projectId: mod.curseforgeProjectId,
        displayName: "Mod 1.2.0",
        fileName: "mod-1.2.0.jar",
        fileDate: "2026-08-01T00:00:00Z",
        releaseType: 1,
        gameId: 432,
        downloadUrl: null,
        fileLength: null,
        sha1: null,
      },
    ]);

    const chosen = await workshopReviewService.setModFile(mod.id, 555);
    expect(chosen).toMatchObject({
      changed: true,
      mod: { fileId: 555, fileName: "mod-1.2.0.jar", fileChosen: true },
    });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileId: 555,
      fileName: "mod-1.2.0.jar",
      fileReleaseType: 1,
      fileChosen: true,
      status: "next_update",
    });

    const repeated = await workshopReviewService.setModFile(mod.id, 555);
    expect(repeated).toMatchObject({ changed: false });

    const reset = await workshopReviewService.setModFile(mod.id, null);
    expect(reset).toMatchObject({ changed: true, mod: { fileChosen: false } });
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileId: 555,
      fileChosen: false,
    });

    const resetAgain = await workshopReviewService.setModFile(mod.id, null);
    expect(resetAgain).toMatchObject({ changed: false });
  });

  it("refuses a file that does not belong to the mod's project", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    vi.mocked(getFilesDetails).mockResolvedValueOnce([
      {
        fileId: 556,
        projectId: mod.curseforgeProjectId + 1,
        displayName: "Other 1.0.0",
        fileName: "other-1.0.0.jar",
        fileDate: "2026-08-01T00:00:00Z",
        releaseType: 1,
        gameId: 432,
        downloadUrl: null,
        fileLength: null,
        sha1: null,
      },
    ]);

    await expect(workshopReviewService.setModFile(mod.id, 556)).rejects.toThrow(
      BadRequestError,
    );
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileChosen: false,
    });
  });

  it("marks the mod's current file chosen without a CurseForge lookup", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileId: 555,
      fileName: "mod-1.2.0.jar",
    });

    const chosen = await workshopReviewService.setModFile(mod.id, 555);
    expect(chosen).toMatchObject({
      changed: true,
      mod: { fileId: 555, fileChosen: true },
    });
    expect(vi.mocked(getFilesDetails)).not.toHaveBeenCalled();
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileId: 555,
      fileName: "mod-1.2.0.jar",
      fileChosen: true,
    });
  });

  it("refuses mods outside next_update", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "testing",
    });

    await expect(workshopReviewService.setModFile(mod.id, 555)).rejects.toThrow(
      /next update/,
    );
  });

  it("refuses mods in an archived workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });

    await expect(workshopReviewService.setModFile(mod.id, 555)).rejects.toThrow(
      /archived/,
    );
  });

  it("throws NotFoundError for an unknown mod", async () => {
    await expect(
      workshopReviewService.setModFile(999_999_999, 555),
    ).rejects.toThrow(NotFoundError);
  });

  it("clears the choice when a review moves the mod out of next_update", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileId: 555,
      fileName: "mod-1.2.0.jar",
      fileChosen: true,
    });

    const sentBack = await workshopReviewService.reviewMod(
      mod.id,
      "send_back",
      ADMIN,
    );
    expect(sentBack.status).toBe("testing");
    expect(sentBack.fileChosen).toBe(false);
    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      fileId: 555,
      fileChosen: false,
    });
  });

  it("clears the choice when the mod is rejected out of next_update", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
      fileId: 555,
      fileChosen: true,
    });

    const rejected = await workshopReviewService.reviewMod(
      mod.id,
      "reject",
      ADMIN,
      {
        reason: "not_a_good_fit",
      },
    );
    expect(rejected.status).toBe("rejected");
    expect(rejected.fileChosen).toBe(false);
  });
});
