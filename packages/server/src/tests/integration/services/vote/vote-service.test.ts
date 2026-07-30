import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";

vi.mock("@/services/vote/discord", () => ({
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
import { voteService } from "@/services/vote";
import { ingestProject } from "@/services/curseforge/ingest";
import {
  createVoteTestContext,
  cleanupVoteTestContext,
  seedVote,
  seedProject,
  seedMod,
  seedRequiredDependency,
  makeProjectData,
} from "@/tests/helpers/vote";

const ADMIN = "999900000000000001";
const USER_A = "999900000000000002";
const USER_B = "999900000000000003";

const ctx = createVoteTestContext(990_000_000);

beforeAll(async () => {
  await pool.query("SELECT 1");
  vi.mocked(ingestProject).mockImplementation(async (projectId: number) => ({
    entity: await Q.curseforge.project.get({ id: projectId }),
    data: makeProjectData(projectId),
  }));
});

afterEach(async () => {
  await cleanupVoteTestContext(ctx);
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("VoteService.reviewMod", () => {
  it("throws BadRequestError when rejecting without a reason", async () => {
    const vote = await seedVote(ctx);
    const mod = await seedMod(ctx, vote, { submittedBy: USER_A });

    await expect(
      voteService.reviewMod(mod.id, "reject", ADMIN),
    ).rejects.toThrow(BadRequestError);

    const unchanged = await Q.vote.mod.get({ id: mod.id });
    expect(unchanged.status).toBe("pending");
  });

  it("sets status, reason, trimmed note, and reviewer on reject", async () => {
    const vote = await seedVote(ctx);
    const mod = await seedMod(ctx, vote, { submittedBy: USER_A });

    const updated = await voteService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "incompatible",
      note: "  crashes with create  ",
    });

    expect(updated.status).toBe("rejected");
    expect(updated.rejectReason).toBe("incompatible");
    expect(updated.rejectNote).toBe("crashes with create");
    expect(updated.reviewedBy).toBe(ADMIN);
    expect(updated.reviewedAt).toBeInstanceOf(Date);

    const persisted = await Q.vote.mod.get({ id: mod.id });
    expect(persisted.status).toBe("rejected");
  });

  it("re-reviews a rejected mod to approved and clears reject fields", async () => {
    const vote = await seedVote(ctx);
    const mod = await seedMod(ctx, vote, { submittedBy: USER_A });

    await voteService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "on_hold",
      note: "maybe next season",
    });
    const approved = await voteService.reviewMod(mod.id, "approve", ADMIN);

    expect(approved.status).toBe("approved");
    expect(approved.rejectReason).toBeNull();
    expect(approved.rejectNote).toBeNull();
    expect(approved.reviewedBy).toBe(ADMIN);
  });

  it("prunes orphaned dependency rows when rejecting a previously approved mod", async () => {
    const vote = await seedVote(ctx);
    const mod = await seedMod(ctx, vote, {
      submittedBy: USER_A,
      status: "approved",
    });
    const depProjectId = await seedProject(ctx);
    const depRow = await seedMod(ctx, vote, {
      curseforgeProjectId: depProjectId,
      source: "dependency",
      status: "approved",
      submittedBy: ADMIN,
    });
    await seedRequiredDependency(mod.id, depProjectId);

    await voteService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "not_a_good_fit",
    });

    expect(await Q.vote.mod.find({ id: depRow.id })).toBeNull();
    const rejected = await Q.vote.mod.get({ id: mod.id });
    expect(rejected.status).toBe("rejected");
  });
});

describe("VoteService.suggestMod", () => {
  it("creates a pending suggestion with the snapshot file", async () => {
    const vote = await seedVote(ctx);
    const projectId = await seedProject(ctx);

    const item = await voteService.suggestMod(vote.id, USER_A, {
      projectId,
      note: "please add",
    });

    expect(item.status).toBe("pending");
    expect(item.source).toBe("user");
    expect(item.submittedBy).toBe(USER_A);
    expect(item.note).toBe("please add");
    expect(item.fileId).toBe(projectId + 1);
    expect(item.project.id).toBe(projectId);
  });

  it("counts only pending suggestions against the cap", async () => {
    const vote = await seedVote(ctx, { maxModsPerUser: 2 });
    await seedMod(ctx, vote, { submittedBy: USER_A, status: "approved" });
    await seedMod(ctx, vote, { submittedBy: USER_A, status: "approved" });
    await seedMod(ctx, vote, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
    });
    const projectId = await seedProject(ctx);

    const item = await voteService.suggestMod(vote.id, USER_A, { projectId });

    expect(item.status).toBe("pending");
  });

  it("enforces the cap once pending suggestions reach the limit", async () => {
    const vote = await seedVote(ctx, { maxModsPerUser: 2 });
    await seedMod(ctx, vote, { submittedBy: USER_A });
    await seedMod(ctx, vote, { submittedBy: USER_A });
    const projectId = await seedProject(ctx);

    await expect(
      voteService.suggestMod(vote.id, USER_A, { projectId }),
    ).rejects.toThrow(
      "You already have 2 pending suggestions in this workshop, remove one or wait for a review",
    );
  });

  it("blocks resuggesting a rejected project with a rejected message", async () => {
    const vote = await seedVote(ctx);
    const projectId = await seedProject(ctx, "Create Stuff");
    await seedMod(ctx, vote, {
      curseforgeProjectId: projectId,
      submittedBy: USER_B,
      status: "rejected",
      rejectReason: "incompatible",
    });

    const attempt = voteService.suggestMod(vote.id, USER_A, { projectId });

    await expect(attempt).rejects.toBeInstanceOf(BadRequestError);
    await expect(attempt).rejects.toThrow(
      "Rejected in this workshop: Create Stuff",
    );
  });

  it("blocks resuggesting a pending project with a conflict", async () => {
    const vote = await seedVote(ctx);
    const projectId = await seedProject(ctx, "Sophisticated Storage");
    await seedMod(ctx, vote, {
      curseforgeProjectId: projectId,
      submittedBy: USER_B,
    });

    const attempt = voteService.suggestMod(vote.id, USER_A, { projectId });

    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
    await expect(attempt).rejects.toThrow(
      "Already suggested in this workshop: Sophisticated Storage",
    );
  });

  it("throws when the workshop is not open", async () => {
    const vote = await seedVote(ctx, { status: "closed" });
    const projectId = await seedProject(ctx);

    await expect(
      voteService.suggestMod(vote.id, USER_A, { projectId }),
    ).rejects.toThrow("This workshop is not open for suggestions");
  });
});

describe("VoteService.toggleModUpvote", () => {
  it("blocks self-upvotes", async () => {
    const vote = await seedVote(ctx);
    const mod = await seedMod(ctx, vote, { submittedBy: USER_A });

    await expect(voteService.toggleModUpvote(mod.id, USER_A)).rejects.toThrow(
      "You cannot upvote your own suggestion",
    );
  });

  it("enforces the budget on pending mods", async () => {
    const vote = await seedVote(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, vote, { submittedBy: USER_B });
    const second = await seedMod(ctx, vote, { submittedBy: USER_B });

    const result = await voteService.toggleModUpvote(first.id, USER_A);
    expect(result).toEqual({
      upvoted: true,
      upvoteCount: 1,
      votesRemaining: 0,
    });

    await expect(
      voteService.toggleModUpvote(second.id, USER_A),
    ).rejects.toThrow(
      "You have used all 1 of your votes, remove one or wait for a review",
    );
  });

  it("allows a free like on an approved mod at zero budget", async () => {
    const vote = await seedVote(ctx, { maxUpvotesPerUser: 1 });
    const pending = await seedMod(ctx, vote, { submittedBy: USER_B });
    const approved = await seedMod(ctx, vote, {
      submittedBy: USER_B,
      status: "approved",
    });
    await voteService.toggleModUpvote(pending.id, USER_A);

    const result = await voteService.toggleModUpvote(approved.id, USER_A);

    expect(result.upvoted).toBe(true);
    expect(result.upvoteCount).toBe(1);
    expect(result.votesRemaining).toBe(0);
  });

  it("refunds the budget when toggling off", async () => {
    const vote = await seedVote(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, vote, { submittedBy: USER_B });
    const second = await seedMod(ctx, vote, { submittedBy: USER_B });
    await voteService.toggleModUpvote(first.id, USER_A);

    const off = await voteService.toggleModUpvote(first.id, USER_A);
    expect(off).toEqual({ upvoted: false, upvoteCount: 0, votesRemaining: 1 });

    const result = await voteService.toggleModUpvote(second.id, USER_A);
    expect(result.upvoted).toBe(true);
  });

  it("refunds the budget when an upvoted mod is reviewed", async () => {
    const vote = await seedVote(ctx, { maxUpvotesPerUser: 1 });
    const first = await seedMod(ctx, vote, { submittedBy: USER_B });
    const second = await seedMod(ctx, vote, { submittedBy: USER_B });
    await voteService.toggleModUpvote(first.id, USER_A);

    await voteService.reviewMod(first.id, "approve", ADMIN);

    const result = await voteService.toggleModUpvote(second.id, USER_A);
    expect(result.upvoted).toBe(true);
    expect(result.votesRemaining).toBe(0);
  });

  it("throws NotFoundError for rejected mods", async () => {
    const vote = await seedVote(ctx);
    const mod = await seedMod(ctx, vote, {
      submittedBy: USER_B,
      status: "rejected",
      rejectReason: "on_hold",
    });

    await expect(voteService.toggleModUpvote(mod.id, USER_A)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("VoteService.getRejectedMods", () => {
  it("returns rejected rows for an open vote", async () => {
    const vote = await seedVote(ctx);
    const rejected = await seedMod(ctx, vote, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "covered_by_other_mod",
      reviewedBy: ADMIN,
      reviewedAt: new Date(),
    });
    await seedMod(ctx, vote, { submittedBy: USER_B });

    const rows = await voteService.getRejectedMods(vote.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(rejected.id);
    expect(rows[0].rejectReason).toBe("covered_by_other_mod");
  });

  it("throws NotFoundError for a draft vote", async () => {
    const vote = await seedVote(ctx, { status: "draft" });

    await expect(voteService.getRejectedMods(vote.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("VoteService.getMySuggestions", () => {
  it("returns the caller's own user rows across statuses", async () => {
    const vote = await seedVote(ctx);
    const pending = await seedMod(ctx, vote, { submittedBy: USER_A });
    const approved = await seedMod(ctx, vote, {
      submittedBy: USER_A,
      status: "approved",
    });
    const rejected = await seedMod(ctx, vote, {
      submittedBy: USER_A,
      status: "rejected",
      rejectReason: "on_hold",
    });
    await seedMod(ctx, vote, { submittedBy: USER_B });
    await seedMod(ctx, vote, {
      submittedBy: USER_A,
      source: "dependency",
      status: "approved",
    });

    const rows = await voteService.getMySuggestions(vote.id, USER_A);

    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [pending.id, approved.id, rejected.id].sort((a, b) => a - b),
    );
    expect(new Set(rows.map((row) => row.status))).toEqual(
      new Set(["pending", "approved", "rejected"]),
    );
  });
});
