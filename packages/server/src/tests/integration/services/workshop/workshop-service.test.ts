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
  ingestProjects: vi.fn(),
  refreshProjects: vi.fn(async () => 0),
}));

import pool, { Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { workshopService } from "@/services/workshop";
import { issueBan, liftBan } from "@/services/workshop/bans";
import { ingestProject, ingestProjects } from "@/services/curseforge/ingest";
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
  modEvents,
  GAME_VERSION,
  MOD_LOADER_TYPE,
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

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
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

    const approved = await workshopService.reviewMod(mod.id, "approve", ADMIN);
    expect(approved.status).toBe("approved");

    const testing = await workshopService.reviewMod(
      mod.id,
      "start_testing",
      ADMIN,
    );
    expect(testing.status).toBe("testing");

    const promoted = await workshopService.reviewMod(mod.id, "approve", ADMIN);
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
      workshopService.reviewMod(pending.id, "start_testing", ADMIN),
    ).rejects.toThrow(BadRequestError);
    await expect(
      workshopService.reviewMod(approved.id, "approve", ADMIN),
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

    const testing = await workshopService.reviewMod(mod.id, "send_back", ADMIN);
    expect(testing.status).toBe("testing");

    const approved = await workshopService.reviewMod(
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
      workshopService.reviewMod(mod.id, "send_back", ADMIN),
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
      workshopService.reviewMod(promoted.id, "approve", ADMIN),
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
      workshopService.reviewMod(promoted.id, "start_testing", ADMIN),
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
      workshopService.reviewMod(mod.id, "send_back", ADMIN),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects from mid-pipeline stages without touching the pack", async () => {
    const workshop = await seedWorkshop(ctx);
    for (const status of ["approved", "testing"] as const) {
      const mod = await seedMod(ctx, workshop, {
        submittedBy: USER_A,
        status,
      });

      const rejected = await workshopService.reviewMod(
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

    const updated = await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "not_a_good_fit",
      note: "covered by the base pack",
    });

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
      workshopService.reviewMod(mod.id, "reject", ADMIN, {
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

    const result = await workshopService.reviewMod(mod.id, "approve", ADMIN);

    expect(result.status).toBe("in_pack");
    const unchanged = await Q.workshop.mod.get({ id: mod.id });
    expect(unchanged.status).toBe("in_pack");
    expect(unchanged.reviewedBy).toBeNull();
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

  it("renames the slug", async () => {
    const workshop = await seedWorkshop(ctx);
    const nextSlug = `${workshop.slug}-renamed`;

    const updated = await workshopService.updateWorkshop(workshop.id, {
      slug: nextSlug,
    });
    expect(updated.slug).toBe(nextSlug);

    const persisted = await Q.workshop.get({ id: workshop.id });
    expect(persisted.slug).toBe(nextSlug);
  });

  it("accepts an unchanged slug", async () => {
    const workshop = await seedWorkshop(ctx);

    const updated = await workshopService.updateWorkshop(workshop.id, {
      slug: workshop.slug,
      name: "Renamed Workshop",
    });
    expect(updated.slug).toBe(workshop.slug);
    expect(updated.name).toBe("Renamed Workshop");
  });

  it("rejects a slug already used by another workshop", async () => {
    const modpackId = (await seedModpack(ctx)).id;
    const workshop = await seedWorkshop(ctx, { modpackId });
    const other = await seedWorkshop(ctx, { modpackId });

    await expect(
      workshopService.updateWorkshop(workshop.id, { slug: other.slug }),
    ).rejects.toThrow(ConflictError);

    const unchanged = await Q.workshop.get({ id: workshop.id });
    expect(unchanged.slug).toBe(workshop.slug);
  });
});

describe("WorkshopService.createWorkshop", () => {
  const baseInput = () => ({
    name: "Vitest Created Workshop",
    slug: `vitest-created-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    gameVersion: GAME_VERSION,
    modLoaderType: MOD_LOADER_TYPE,
  });

  it("creates the workshop and a new modpack together when given a name", async () => {
    const workshop = await workshopService.createWorkshop(
      { ...baseInput(), newModpackName: "Vitest Inline Pack" },
      ADMIN,
    );
    ctx.workshopIds.push(workshop.id);
    ctx.modpackIds.push(workshop.modpackId);

    const modpack = await Q.modpack.get({ id: workshop.modpackId });
    expect(modpack.name).toBe("Vitest Inline Pack");
    expect(modpack.createdBy).toBe(ADMIN);
    expect(modpack.curseforgeProjectId).toBeNull();
    expect(workshop.status).toBe("draft");
  });

  it("rejects when both an existing modpack and a new name are provided", async () => {
    const modpack = await seedModpack(ctx);

    await expect(
      workshopService.createWorkshop(
        { ...baseInput(), modpackId: modpack.id, newModpackName: "Nope" },
        ADMIN,
      ),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects when neither an existing modpack nor a new name is provided", async () => {
    await expect(
      workshopService.createWorkshop(baseInput(), ADMIN),
    ).rejects.toThrow(BadRequestError);
  });

  it("leaves no modpack behind when the slug is already taken", async () => {
    const existing = await seedWorkshop(ctx);

    await expect(
      workshopService.createWorkshop(
        {
          ...baseInput(),
          slug: existing.slug,
          newModpackName: "Vitest Orphan Check",
        },
        ADMIN,
      ),
    ).rejects.toThrow(ConflictError);

    const strays = await Q.modpack.findAll({ name: "Vitest Orphan Check" });
    expect(strays).toHaveLength(0);
  });
});

describe("workshop deletion", () => {
  it("nulls the pack row's workshop_mod_id when the workshop is deleted", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { status: "next_update" });
    const packRow = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
    });

    await Q.workshop.deleteAll({ id: workshop.id });

    const after = await Q.modpack.mod.get({ id: packRow.id });
    expect(after.workshopModId).toBeNull();
  });
});

describe("WorkshopService.suggestMod", () => {
  it("rejects with BadRequestError when CurseForge cannot resolve the project", async () => {
    const workshop = await seedWorkshop(ctx);
    vi.mocked(ingestProjects).mockResolvedValueOnce(new Map());

    await expect(
      workshopService.suggestMod(workshop.id, USER_A, {
        projectId: 990_999_999,
        note: "a mod the pack really needs",
      }),
    ).rejects.toThrow(BadRequestError);
  });

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

  it("starts the suggestion with the caller's own upvote", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const projectId = await seedProject(ctx);

    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
    });

    expect(item.upvoteCount).toBe(1);
    const upvote = await Q.workshop.mod.upvote.find({
      workshopModId: item.id,
      discordId: USER_A,
    });
    expect(upvote).not.toBeNull();

    const budget = await workshopService.getMyUpvotes(workshop.id, USER_A);
    expect(budget.votesRemaining).toBe(1);
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

describe("workshop suggestion bans", () => {
  const ADMIN_ACTOR = { discordId: ADMIN, username: "admin" };

  // Scoped bans cascade with their workshop, global ones have nothing to
  // cascade from and would leak into later tests.
  afterEach(async () => {
    await Q.workshop.ban.deleteAll({
      discordId: { $in: [ADMIN, USER_A, USER_B] },
    });
  });

  it("blocks suggesting in the workshop it is scoped to", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);
    await issueBan(
      { discordId: USER_A, workshopId: workshop.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    await expect(
      workshopService.suggestMod(workshop.id, USER_A, { projectId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("leaves other workshops and other users alone", async () => {
    const banned = await seedWorkshop(ctx);
    const other = await seedWorkshop(ctx);
    await issueBan(
      { discordId: USER_A, workshopId: banned.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    const elsewhere = await workshopService.suggestMod(other.id, USER_A, {
      projectId: await seedProject(ctx),
    });
    expect(elsewhere.status).toBe("pending");

    const otherUser = await workshopService.suggestMod(banned.id, USER_B, {
      projectId: await seedProject(ctx),
    });
    expect(otherUser.status).toBe("pending");
  });

  it("blocks every workshop when scoped globally", async () => {
    const first = await seedWorkshop(ctx);
    const second = await seedWorkshop(ctx);
    await issueBan(
      { discordId: USER_A, workshopId: null, reason: "repeat abuse" },
      ADMIN_ACTOR,
    );

    await expect(
      workshopService.suggestMod(first.id, USER_A, {
        projectId: await seedProject(ctx),
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      workshopService.suggestMod(second.id, USER_A, {
        projectId: await seedProject(ctx),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("stops blocking once lifted", async () => {
    const workshop = await seedWorkshop(ctx);
    const ban = await issueBan(
      { discordId: USER_A, workshopId: workshop.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    await liftBan(ban.id, "appealed", ADMIN_ACTOR);

    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId: await seedProject(ctx),
    });
    expect(item.status).toBe("pending");
  });

  it("stops blocking once elapsed, with no sweeper involved", async () => {
    const workshop = await seedWorkshop(ctx);
    await Q.workshop.ban.create({
      discordId: USER_A,
      workshopId: workshop.id,
      banType: "temporary",
      reason: "old",
      bannedByDiscordId: ADMIN,
      bannedByUsername: "admin",
      bannedAt: new Date(Date.now() - 30 * 86_400_000),
      expiresAt: new Date(Date.now() - 86_400_000),
    });

    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId: await seedProject(ctx),
    });
    expect(item.status).toBe("pending");
  });

  it("leaves upvoting and withdrawing existing suggestions untouched", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 5 });
    const own = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId: await seedProject(ctx),
    });
    const othersMod = await seedMod(ctx, workshop, {
      submittedBy: USER_B,
    });

    await issueBan(
      { discordId: USER_A, workshopId: workshop.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    const vote = await workshopService.toggleModUpvote(othersMod.id, USER_A);
    expect(vote.upvoted).toBe(true);

    await expect(
      workshopService.removeSuggestion(own.id, USER_A),
    ).resolves.toBeUndefined();
  });

  it("does not gate admin adds, even for a blocked admin", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);
    await issueBan(
      { discordId: ADMIN, workshopId: null, reason: "blocked as a user" },
      ADMIN_ACTOR,
    );

    const rows = await workshopService.addModsAsAdmin(
      workshop.id,
      [projectId],
      ADMIN,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("approved");
  });

  it("rejects a duplicate in the same scope but allows global alongside scoped", async () => {
    const workshop = await seedWorkshop(ctx);
    await issueBan(
      { discordId: USER_A, workshopId: workshop.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    await expect(
      issueBan(
        { discordId: USER_A, workshopId: workshop.id, reason: "again" },
        ADMIN_ACTOR,
      ),
    ).rejects.toThrow(ConflictError);

    const global = await issueBan(
      { discordId: USER_A, workshopId: null, reason: "everywhere" },
      ADMIN_ACTOR,
    );
    expect(global.workshopId).toBeNull();
  });
});

describe("WorkshopService.toggleModUpvote", () => {
  it("allows self-upvotes without consuming the budget", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const own = await seedMod(ctx, workshop, { submittedBy: USER_A });

    const result = await workshopService.toggleModUpvote(own.id, USER_A);

    expect(result).toEqual({
      upvoted: true,
      upvoteCount: 1,
      votesRemaining: 1,
    });
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
  it("creates approved suggestions credited to the admin, with no pack row yet", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectA = await seedProject(ctx);
    const projectB = await seedProject(ctx);

    const rows = await workshopService.addModsAsAdmin(
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
    const [added] = await workshopService.addModsAsAdmin(
      workshop.id,
      [projectId],
      ADMIN,
    );

    await workshopService.reviewMod(added!.id, "start_testing", ADMIN);
    await expect(
      workshopService.reviewMod(added!.id, "send_back", ADMIN),
    ).resolves.toMatchObject({ status: "approved" });

    await workshopService.reviewMod(added!.id, "start_testing", ADMIN);
    await expect(
      workshopService.reviewMod(added!.id, "approve", ADMIN),
    ).resolves.toMatchObject({ status: "next_update" });
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

    expect(await Q.workshop.mod.count({ workshopId: workshop.id })).toBe(0);
  });

  it("rejects a project a player already suggested", async () => {
    const workshop = await seedWorkshop(ctx);
    const suggested = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await expect(
      workshopService.addModsAsAdmin(
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
      workshopService.addModsAsAdmin(workshop.id, [projectId], ADMIN),
    ).rejects.toThrow("Cannot add mods to an archived workshop");
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

describe("WorkshopService timeline events", () => {
  it("records suggested and review events through the pipeline", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
      note: "adds cool automation",
    });
    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(1);
    });
    expect((await modEvents(item.id))[0]).toMatchObject({
      eventType: "suggested",
      workshopId: workshop.id,
      curseforgeProjectId: projectId,
      actorDiscordId: USER_A,
      fromStatus: null,
      toStatus: "pending",
      note: "adds cool automation",
    });

    await workshopService.reviewMod(item.id, "approve", ADMIN);
    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(2);
    });
    expect((await modEvents(item.id))[1]).toMatchObject({
      eventType: "approved",
      actorDiscordId: ADMIN,
      fromStatus: "pending",
      toStatus: "approved",
    });

    await workshopService.reviewMod(item.id, "reject", ADMIN, {
      reason: "on_hold",
      note: "revisit later",
    });
    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(3);
    });
    expect((await modEvents(item.id))[2]).toMatchObject({
      eventType: "rejected",
      fromStatus: "approved",
      toStatus: "rejected",
      rejectReason: "on_hold",
      note: "revisit later",
    });
  });

  it("keeps a withdrawn suggestion's events after the row is deleted", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);
    const item = await workshopService.suggestMod(workshop.id, USER_A, {
      projectId,
    });

    await workshopService.removeSuggestion(item.id, USER_A);

    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(2);
    });
    expect(await Q.workshop.mod.find({ id: item.id })).toBeNull();
    expect((await modEvents(item.id))[1]).toMatchObject({
      eventType: "withdrawn",
      actorDiscordId: USER_A,
      fromStatus: "pending",
    });
  });

  it("does not record an event for an idempotent review no-op", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "approved",
    });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);
    await workshopService.reviewMod(mod.id, "start_testing", ADMIN);

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });
    expect((await modEvents(mod.id))[0]).toMatchObject({
      eventType: "testing_started",
      fromStatus: "approved",
      toStatus: "testing",
    });
  });

  it("skips repeat rejects that change nothing but records reason edits", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, { submittedBy: USER_A });

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
      note: "crashes with create",
    });
    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
      note: "  crashes with create  ",
    });

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "not_a_good_fit",
    });

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(2);
    });
    expect((await modEvents(mod.id))[1]).toMatchObject({
      eventType: "rejected",
      fromStatus: "rejected",
      toStatus: "rejected",
      rejectReason: "not_a_good_fit",
      note: null,
    });
  });

  it("records admin adds as suggested events entering at approved", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    const [item] = await workshopService.addModsAsAdmin(
      workshop.id,
      [projectId],
      ADMIN,
      "team pick for the season",
    );

    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(1);
    });
    expect((await modEvents(item.id))[0]).toMatchObject({
      eventType: "suggested",
      actorDiscordId: ADMIN,
      fromStatus: null,
      toStatus: "approved",
      note: "team pick for the season",
    });
  });
});

describe("WorkshopService.deleteWorkshop", () => {
  it("refuses a workshop that is not archived", async () => {
    const workshop = await seedWorkshop(ctx, { status: "open" });

    await expect(workshopService.deleteWorkshop(workshop.id)).rejects.toThrow(
      BadRequestError,
    );

    expect(await Q.workshop.find({ id: workshop.id })).not.toBeNull();
  });

  it("deletes an archived workshop and detaches pack member credit", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const mod = await seedMod(ctx, workshop, { status: "in_pack" });
    const member = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
    });

    await workshopService.deleteWorkshop(workshop.id);

    expect(await Q.workshop.find({ id: workshop.id })).toBeNull();
    expect(await Q.workshop.mod.find({ id: mod.id })).toBeNull();
    const survivor = await Q.modpack.mod.get({ id: member.id });
    expect(survivor.workshopModId).toBeNull();
    expect(survivor.origin).toBe("suggestion");
  });

  it("takes polls, poll mods, and ballots with the workshop", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const mod = await seedMod(ctx, workshop);
    const poll = await Q.workshop.poll.createAndReturn({
      workshopId: workshop.id,
      granularity: "per_mod",
      endsAt: new Date(Date.now() + 60_000),
      createdBy: ADMIN,
    });
    const pollMod = await Q.workshop.poll.mod.createAndReturn({
      pollId: poll.id,
      workshopModId: mod.id,
    });
    const ballot = await Q.workshop.poll.ballot.createAndReturn({
      pollId: poll.id,
      pollModId: pollMod.id,
      discordId: USER_A,
      choice: true,
    });

    await workshopService.deleteWorkshop(workshop.id);

    expect(await Q.workshop.poll.find({ id: poll.id })).toBeNull();
    expect(await Q.workshop.poll.mod.find({ id: pollMod.id })).toBeNull();
    expect(await Q.workshop.poll.ballot.find({ id: ballot.id })).toBeNull();
  });
});

describe("WorkshopService.setProjectEnvironment", () => {
  it("stores an explicit side as a manual flag", async () => {
    const projectId = await seedProject(ctx);

    const updated = await workshopService.setProjectEnvironment(
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

    await workshopService.setProjectEnvironment(projectId, "unspecified");

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "unspecified",
      environmentSource: null,
    });
  });

  it("throws NotFoundError for a project that is not cached", async () => {
    await expect(
      workshopService.setProjectEnvironment(ctx.nextProjectId++, "both"),
    ).rejects.toThrow(NotFoundError);
  });
});
