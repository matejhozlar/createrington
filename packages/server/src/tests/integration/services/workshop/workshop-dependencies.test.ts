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
    getModpackManifest: vi.fn(async () => ({
      version: null,
      modIds: new Set<number>(),
    })),
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
import { NotFoundError } from "@/app/middleware/error-handler";
import { workshopService } from "@/services/workshop";
import { loadDependencyContext } from "@/services/workshop/dependencies";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedWorkshop,
  seedProject,
  seedMod,
  seedPackMod,
  seedRequiredDependency,
  makeProjectData,
} from "@/tests/helpers/workshop";

const ADMIN = "999900000000000001";
const USER_A = "999900000000000002";

const ctx = createWorkshopTestContext(991_000_000);

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

describe("loadDependencyContext", () => {
  it("reports where each dependency stands and how many mods want it", async () => {
    const workshop = await seedWorkshop(ctx);
    const staged = await seedMod(ctx, workshop, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const alsoStaged = await seedMod(ctx, workshop, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const inReview = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const ruledOut = await seedMod(ctx, workshop, {
      status: "rejected",
      rejectReason: "not_a_good_fit",
      submittedBy: USER_A,
    });
    const published = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const nowhere = await seedProject(ctx);

    for (const subject of [staged, alsoStaged]) {
      await seedRequiredDependency(
        workshop,
        subject.curseforgeProjectId,
        nowhere,
      );
    }
    await seedRequiredDependency(
      workshop,
      staged.curseforgeProjectId,
      published.curseforgeProjectId,
    );
    // A mod still in review does not make anything wanted yet
    await seedRequiredDependency(
      workshop,
      inReview.curseforgeProjectId,
      ruledOut.curseforgeProjectId,
    );

    const { coverage, demand } = await loadDependencyContext(workshop);

    expect(coverage.get(staged.curseforgeProjectId)).toBe("staged");
    expect(coverage.get(inReview.curseforgeProjectId)).toBe("in_review");
    expect(coverage.get(ruledOut.curseforgeProjectId)).toBe("rejected");
    expect(coverage.get(published.curseforgeProjectId)).toBe("published");
    expect(coverage.get(nowhere)).toBeUndefined();

    expect(demand.get(nowhere)).toBe(2);
    expect(demand.get(published.curseforgeProjectId)).toBe(1);
    expect(demand.get(ruledOut.curseforgeProjectId)).toBeUndefined();
  });

  it("counts a suggestion already in the pack as published", async () => {
    const workshop = await seedWorkshop(ctx);
    const shipped = await seedMod(ctx, workshop, {
      status: "in_pack",
      submittedBy: USER_A,
    });

    const { coverage } = await loadDependencyContext(workshop);

    expect(coverage.get(shipped.curseforgeProjectId)).toBe("published");
  });
});

describe("getWorkshopDependencies", () => {
  it("aggregates one row per dependency with coverage, requirers, and demand", async () => {
    const workshop = await seedWorkshop(ctx);
    const staged = await seedMod(ctx, workshop, {
      status: "next_update",
      submittedBy: USER_A,
    });
    const inReview = await seedMod(ctx, workshop, { submittedBy: USER_A });
    const published = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    const nowhere = await seedProject(ctx, "Zeta Lib");

    await seedRequiredDependency(workshop, staged.curseforgeProjectId, nowhere);
    await seedRequiredDependency(
      workshop,
      inReview.curseforgeProjectId,
      nowhere,
    );
    await Q.workshop.project.dependency.create({
      workshopId: workshop.id,
      curseforgeProjectId: staged.curseforgeProjectId,
      dependsOnProjectId: published.curseforgeProjectId,
      relationType: 2,
    });

    const rows = await workshopService.getWorkshopDependencies(workshop.id);

    expect(rows).toHaveLength(2);
    const missing = rows.find((row) => row.curseforgeProjectId === nowhere);
    expect(missing).toMatchObject({
      name: "Zeta Lib",
      coverage: "missing",
      optionalByCount: 0,
      shippingDemand: 1,
    });
    expect(
      missing!.requiredBy.map((entry) => entry.curseforgeProjectId).sort(),
    ).toEqual(
      [staged.curseforgeProjectId, inReview.curseforgeProjectId].sort(),
    );

    const optionalDep = rows.find(
      (row) => row.curseforgeProjectId === published.curseforgeProjectId,
    );
    expect(optionalDep).toMatchObject({
      coverage: "published",
      requiredBy: [],
      optionalByCount: 1,
      shippingDemand: 0,
    });
  });

  it("returns nothing for a workshop without dependency edges", async () => {
    const workshop = await seedWorkshop(ctx);
    await seedMod(ctx, workshop, { submittedBy: USER_A });

    expect(await workshopService.getWorkshopDependencies(workshop.id)).toEqual(
      [],
    );
  });

  it("throws NotFoundError for an unknown workshop", async () => {
    await expect(
      workshopService.getWorkshopDependencies(999_999_999),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("reviewMod pack rows", () => {
  it("does not create a pack row when a mod is staged for the next update", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      status: "testing",
      submittedBy: USER_A,
    });

    await workshopService.reviewMod(mod.id, "approve", ADMIN);

    expect(await Q.workshop.mod.get({ id: mod.id })).toMatchObject({
      status: "next_update",
    });
    expect(await Q.modpack.mod.count({ modpackId: workshop.modpackId })).toBe(
      0,
    );
  });

  it("leaves a published row in place when its rejected suggestion is re-reviewed", async () => {
    const workshop = await seedWorkshop(ctx);
    const mod = await seedMod(ctx, workshop, {
      status: "rejected",
      rejectReason: "incompatible",
      submittedBy: USER_A,
    });
    const row = await seedPackMod(ctx, workshop, {
      curseforgeProjectId: mod.curseforgeProjectId,
      origin: "suggestion",
      workshopModId: mod.id,
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });

    await workshopService.reviewMod(mod.id, "reject", ADMIN, {
      reason: "not_a_good_fit",
    });

    expect(await Q.modpack.mod.find({ id: row.id })).not.toBeNull();
  });
});
