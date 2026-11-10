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
  ForbiddenError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { workshopSuggestionService } from "@/services/workshop/suggestion.service";
import { workshopReviewService } from "@/services/workshop/review.service";
import { issueBan, liftBan } from "@/services/workshop/bans";
import { CurseForgeClass } from "@/services/curseforge/client";
import { searchMods } from "@/services/curseforge/mods";
import { ingestProject, ingestProjects } from "@/services/curseforge/ingest";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedWorkshop,
  seedProject,
  seedMod,
  makeProjectData,
  modEvents,
  GAME_VERSION,
  mockNextIngestAs,
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

describe("WorkshopSuggestionService.suggestMod", () => {
  it("rejects with BadRequestError when CurseForge cannot resolve the project", async () => {
    const workshop = await seedWorkshop(ctx);
    vi.mocked(ingestProjects).mockResolvedValueOnce(new Map());

    await expect(
      workshopSuggestionService.suggestMod(workshop.id, USER_A, {
        projectId: 990_999_999,
        note: "a mod the pack really needs",
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("creates a pending suggestion with the snapshot file", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId,
        note: "please add",
      },
    );

    expect(item.status).toBe("pending");
    expect(item.submittedBy).toBe(USER_A);
    expect(item.note).toBe("please add");
    expect(item.fileId).toBe(projectId + 1);
    expect(item.project.id).toBe(projectId);
  });

  it("refuses a resource pack, which only admins can add", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx, "Vitest Resource Pack", {
      classId: CurseForgeClass.resourcePacks,
    });
    mockNextIngestAs(CurseForgeClass.resourcePacks);

    await expect(
      workshopSuggestionService.suggestMod(workshop.id, USER_A, { projectId }),
    ).rejects.toThrow(BadRequestError);
    expect(ingestProjects).toHaveBeenCalledTimes(1);
  });

  it("starts the suggestion with the caller's own upvote", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const projectId = await seedProject(ctx);

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId,
      },
    );

    expect(item.upvoteCount).toBe(1);
    const upvote = await Q.workshop.mod.upvote.find({
      workshopModId: item.id,
      discordId: USER_A,
    });
    expect(upvote).not.toBeNull();

    const budget = await workshopSuggestionService.getMyUpvotes(
      workshop.id,
      USER_A,
    );
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

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId,
      },
    );

    expect(item.status).toBe("pending");
  });

  it("enforces the cap once pending suggestions reach the limit", async () => {
    const workshop = await seedWorkshop(ctx, { maxModsPerUser: 2 });
    await seedMod(ctx, workshop, { submittedBy: USER_A });
    await seedMod(ctx, workshop, { submittedBy: USER_A });
    const projectId = await seedProject(ctx);

    await expect(
      workshopSuggestionService.suggestMod(workshop.id, USER_A, { projectId }),
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

    const attempt = workshopSuggestionService.suggestMod(workshop.id, USER_A, {
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

    const attempt = workshopSuggestionService.suggestMod(workshop.id, USER_A, {
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
      workshopSuggestionService.suggestMod(workshop.id, USER_A, { projectId }),
    ).rejects.toThrow("This workshop is not open for suggestions");
  });
});

describe("workshop suggestion bans", () => {
  const ADMIN_ACTOR = { adminDiscordId: ADMIN, adminUsername: "admin" };

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
      workshopSuggestionService.suggestMod(workshop.id, USER_A, { projectId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("leaves other workshops and other users alone", async () => {
    const banned = await seedWorkshop(ctx);
    const other = await seedWorkshop(ctx);
    await issueBan(
      { discordId: USER_A, workshopId: banned.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    const elsewhere = await workshopSuggestionService.suggestMod(
      other.id,
      USER_A,
      {
        projectId: await seedProject(ctx),
      },
    );
    expect(elsewhere.status).toBe("pending");

    const otherUser = await workshopSuggestionService.suggestMod(
      banned.id,
      USER_B,
      {
        projectId: await seedProject(ctx),
      },
    );
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
      workshopSuggestionService.suggestMod(first.id, USER_A, {
        projectId: await seedProject(ctx),
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      workshopSuggestionService.suggestMod(second.id, USER_A, {
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

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId: await seedProject(ctx),
      },
    );
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

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId: await seedProject(ctx),
      },
    );
    expect(item.status).toBe("pending");
  });

  it("leaves upvoting and withdrawing existing suggestions untouched", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 5 });
    const own = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId: await seedProject(ctx),
      },
    );
    const othersMod = await seedMod(ctx, workshop, {
      submittedBy: USER_B,
    });

    await issueBan(
      { discordId: USER_A, workshopId: workshop.id, reason: "spam" },
      ADMIN_ACTOR,
    );

    const vote = await workshopSuggestionService.toggleModUpvote(
      othersMod.id,
      USER_A,
    );
    expect(vote.upvoted).toBe(true);

    await expect(
      workshopSuggestionService.removeSuggestion(own.id, USER_A),
    ).resolves.toBeUndefined();
  });

  it("does not gate admin adds, even for a blocked admin", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);
    await issueBan(
      { discordId: ADMIN, workshopId: null, reason: "blocked as a user" },
      ADMIN_ACTOR,
    );

    const rows = await workshopReviewService.addModsAsAdmin(
      workshop.id,
      [projectId],
      ADMIN,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("approved");
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

describe("WorkshopSuggestionService.toggleModUpvote", () => {
  it("allows self-upvotes without consuming the budget", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const own = await seedMod(ctx, workshop, { submittedBy: USER_A });

    const result = await workshopSuggestionService.toggleModUpvote(
      own.id,
      USER_A,
    );

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

    const result = await workshopSuggestionService.toggleModUpvote(
      first.id,
      USER_A,
    );
    expect(result).toEqual({
      upvoted: true,
      upvoteCount: 1,
      votesRemaining: 0,
    });

    await expect(
      workshopSuggestionService.toggleModUpvote(second.id, USER_A),
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
    await workshopSuggestionService.toggleModUpvote(pending.id, USER_A);

    const result = await workshopSuggestionService.toggleModUpvote(
      approved.id,
      USER_A,
    );

    expect(result.upvoted).toBe(true);
    expect(result.upvoteCount).toBe(1);
    expect(result.votesRemaining).toBe(0);
  });

  it("refunds the budget when toggling off", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, workshop, { submittedBy: USER_B });
    const second = await seedMod(ctx, workshop, { submittedBy: USER_B });
    await workshopSuggestionService.toggleModUpvote(first.id, USER_A);

    const off = await workshopSuggestionService.toggleModUpvote(
      first.id,
      USER_A,
    );
    expect(off).toEqual({ upvoted: false, upvoteCount: 0, votesRemaining: 1 });

    const result = await workshopSuggestionService.toggleModUpvote(
      second.id,
      USER_A,
    );
    expect(result.upvoted).toBe(true);
  });

  it("refunds the budget when an upvoted mod is reviewed", async () => {
    const workshop = await seedWorkshop(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, workshop, { submittedBy: USER_B });
    const second = await seedMod(ctx, workshop, { submittedBy: USER_B });
    await workshopSuggestionService.toggleModUpvote(first.id, USER_A);

    await workshopReviewService.reviewMod(first.id, "approve", ADMIN);

    const result = await workshopSuggestionService.toggleModUpvote(
      second.id,
      USER_A,
    );
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
      workshopSuggestionService.toggleModUpvote(mod.id, USER_A),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkshopSuggestionService.searchProjects", () => {
  it("searches an extra addable class without the loader filter", async () => {
    const workshop = await seedWorkshop(ctx);

    await workshopSuggestionService.searchProjects(workshop.id, "faithful", {
      classId: CurseForgeClass.resourcePacks,
    });

    expect(searchMods).toHaveBeenCalledWith("faithful", 20, {
      gameVersion: GAME_VERSION,
      modLoaderType: null,
      classId: CurseForgeClass.resourcePacks,
      packProjectId: null,
    });
  });

  it("keeps the loader filter for the workshop's own class", async () => {
    const workshop = await seedWorkshop(ctx);

    await workshopSuggestionService.searchProjects(workshop.id, "sodium");

    expect(searchMods).toHaveBeenCalledWith("sodium", 20, {
      gameVersion: GAME_VERSION,
      modLoaderType: MOD_LOADER_TYPE,
      classId: CurseForgeClass.mods,
      packProjectId: null,
    });
  });

  it("rejects a class the workshop cannot take", async () => {
    const workshop = await seedWorkshop(ctx);

    await expect(
      workshopSuggestionService.searchProjects(workshop.id, "anything", {
        classId: CurseForgeClass.modpacks,
      }),
    ).rejects.toThrow(BadRequestError);
    expect(searchMods).not.toHaveBeenCalled();
  });

  it("ignores a class override on user-visible searches", async () => {
    const workshop = await seedWorkshop(ctx);

    await workshopSuggestionService.searchProjects(workshop.id, "faithful", {
      userVisible: true,
      classId: CurseForgeClass.resourcePacks,
    });

    expect(searchMods).toHaveBeenCalledWith(
      "faithful",
      20,
      expect.objectContaining({
        classId: CurseForgeClass.mods,
        modLoaderType: MOD_LOADER_TYPE,
      }),
    );
  });

  it("keeps the loader filter for a non-mods class with loader-tagged files", async () => {
    const workshop = await seedWorkshop(ctx, {
      classId: CurseForgeClass.modpacks,
    });

    await workshopSuggestionService.searchProjects(workshop.id, "skyfactory");

    expect(searchMods).toHaveBeenCalledWith(
      "skyfactory",
      20,
      expect.objectContaining({
        classId: CurseForgeClass.modpacks,
        modLoaderType: MOD_LOADER_TYPE,
      }),
    );
  });

  it("offers no extra classes on a non-mods workshop", async () => {
    const workshop = await seedWorkshop(ctx, {
      classId: CurseForgeClass.modpacks,
    });

    await expect(
      workshopSuggestionService.searchProjects(workshop.id, "faithful", {
        classId: CurseForgeClass.resourcePacks,
      }),
    ).rejects.toThrow(BadRequestError);
    expect(searchMods).not.toHaveBeenCalled();
  });
});

describe("workshop timeline events", () => {
  it("records suggested and review events through the pipeline", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx);

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId,
        note: "adds cool automation",
      },
    );
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

    await workshopReviewService.reviewMod(item.id, "approve", ADMIN);
    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(2);
    });
    expect((await modEvents(item.id))[1]).toMatchObject({
      eventType: "approved",
      actorDiscordId: ADMIN,
      fromStatus: "pending",
      toStatus: "approved",
    });

    await workshopReviewService.reviewMod(item.id, "reject", ADMIN, {
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
    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_A,
      {
        projectId,
      },
    );

    await workshopSuggestionService.removeSuggestion(item.id, USER_A);

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

    await workshopReviewService.reviewMod(mod.id, "approve", ADMIN);
    await workshopReviewService.reviewMod(mod.id, "start_testing", ADMIN);

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

    await workshopReviewService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
      note: "crashes with create",
    });
    await workshopReviewService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
      note: "  crashes with create  ",
    });

    await vi.waitFor(async () => {
      expect(await modEvents(mod.id)).toHaveLength(1);
    });

    await workshopReviewService.reviewMod(mod.id, "reject", ADMIN, {
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

    const [item] = await workshopReviewService.addModsAsAdmin(
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
