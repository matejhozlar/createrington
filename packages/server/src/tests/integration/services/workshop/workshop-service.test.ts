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
import { NotFoundError } from "@/app/middleware/error-handler";
import { workshopService } from "@/services/workshop/workshop.service";
import { workshopSuggestionService } from "@/services/workshop/suggestion.service";
import { workshopReviewService } from "@/services/workshop/review.service";
import { ingestProject, ingestProjects } from "@/services/curseforge/ingest";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedProject,
  seedMod,
  seedPackMod,
  makeProjectData,
  modEvents,
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

async function upvoteMod(
  workshopModId: number,
  discordIds: string[],
): Promise<void> {
  for (const discordId of discordIds) {
    await Q.workshop.mod.upvote.create({ workshopModId, discordId });
  }
}

describe("WorkshopService.listVisibleWorkshops", () => {
  it("ranks only pending suggestions in the summary", async () => {
    const workshop = await seedWorkshop(ctx, { status: "open" });
    const shipped = await seedMod(ctx, workshop, { status: "in_pack" });
    const approved = await seedMod(ctx, workshop, { status: "approved" });
    const leadingPending = await seedMod(ctx, workshop, { status: "pending" });
    const trailingPending = await seedMod(ctx, workshop, { status: "pending" });
    await seedMod(ctx, workshop, {
      status: "rejected",
      rejectReason: "on_hold",
    });
    await upvoteMod(shipped.id, [USER_A, USER_B, ADMIN]);
    await upvoteMod(approved.id, [USER_A, USER_B]);
    await upvoteMod(leadingPending.id, [USER_A, USER_B]);
    await upvoteMod(trailingPending.id, [USER_A]);

    const listed = (await workshopService.listVisibleWorkshops()).find(
      (row) => row.id === workshop.id,
    );

    expect(listed?.summary?.topMods).toMatchObject([
      { workshopModId: leadingPending.id, upvoteCount: 2 },
      { workshopModId: trailingPending.id, upvoteCount: 1 },
    ]);
    expect(listed?.summary?.pendingModCount).toBe(2);
    expect(listed?.summary?.suggestionCount).toBe(4);
  });

  it("breaks upvote ties newest first and keeps the top three", async () => {
    const workshop = await seedWorkshop(ctx, { status: "open" });
    const mods = [];
    for (let i = 0; i < 4; i++) {
      mods.push(await seedMod(ctx, workshop, { status: "pending" }));
    }
    await upvoteMod(mods[1].id, [USER_A]);

    const listed = (await workshopService.listVisibleWorkshops()).find(
      (row) => row.id === workshop.id,
    );

    expect(listed?.summary?.topMods.map((row) => row.workshopModId)).toEqual([
      mods[1].id,
      mods[3].id,
      mods[2].id,
    ]);
  });

  it("counts every participant but samples only those with a player row", async () => {
    const PLAYER = "999900000000000005";
    await Q.player.create({
      minecraftUuid: "99990000-0000-4000-8000-000000000005",
      minecraftUsername: "vitest_participant",
      discordId: PLAYER,
    });
    try {
      const workshop = await seedWorkshop(ctx, { status: "open" });
      const suggested = await seedMod(ctx, workshop, { submittedBy: PLAYER });
      await seedMod(ctx, workshop, { submittedBy: USER_A });
      await upvoteMod(suggested.id, [USER_A, USER_B]);

      const listed = (await workshopService.listVisibleWorkshops()).find(
        (row) => row.id === workshop.id,
      );

      expect(listed?.summary?.participantCount).toBe(3);
      expect(listed?.summary?.participantSample).toEqual([
        {
          minecraftUuid: "99990000-0000-4000-8000-000000000005",
          minecraftUsername: "vitest_participant",
        },
      ]);
    } finally {
      await Q.player.deleteAll({ discordId: PLAYER });
    }
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

  it("omits members the latest publish dropped", async () => {
    const workshop = await seedWorkshop(ctx, { status: "open" });
    const live = await seedPackMod(ctx, workshop, {
      liveAt: new Date(),
      liveInVersion: "1.0.0",
    });
    await seedPackMod(ctx, workshop, {
      origin: "dependency",
      droppedFromManifestAt: new Date(),
    });

    const pack = await workshopService.getPack(workshop.id);
    expect(pack.mods.map((row) => row.id)).toEqual([live.id]);

    const listed = (await workshopService.listVisibleWorkshops()).find(
      (row) => row.id === workshop.id,
    );
    expect(listed?.summary?.packModCount).toBe(1);
    expect(listed?.summary?.packModSample.map((row) => row.id)).toEqual([
      live.id,
    ]);
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

describe("WorkshopService.getWorkshopEvents", () => {
  const ACTOR = "999900000000000004";
  const ACTOR_UUID = "99990000-0000-4000-8000-000000000004";

  afterEach(async () => {
    await Q.player.deleteAll({ discordId: ACTOR });
  });

  async function seedActor() {
    await Q.player.create({
      minecraftUuid: ACTOR_UUID,
      minecraftUsername: "vitest_actor",
      discordId: ACTOR,
    });
  }

  it("lists events newest first with the project, actor, and live row resolved", async () => {
    const workshop = await seedWorkshop(ctx);
    const projectId = await seedProject(ctx, "Create Aeronautics");
    await seedActor();

    const item = await workshopSuggestionService.suggestMod(
      workshop.id,
      ACTOR,
      {
        projectId,
        note: "flying trains",
      },
    );
    await workshopReviewService.reviewMod(item.id, "approve", ADMIN);
    await vi.waitFor(async () => {
      expect(await modEvents(item.id)).toHaveLength(2);
    });

    const { events, total } = await workshopService.getWorkshopEvents(
      workshop.id,
      { limit: 10, offset: 0 },
    );

    expect(total).toBe(2);
    expect(events.map((event) => event.eventType)).toEqual([
      "approved",
      "suggested",
    ]);
    expect(events[1]).toMatchObject({
      workshopModId: item.id,
      note: "flying trains",
      project: { name: "Create Aeronautics", classId: 6 },
      actor: { minecraftUsername: "vitest_actor", minecraftUuid: ACTOR_UUID },
      modExists: true,
    });
    expect(events[0]).toMatchObject({
      actorDiscordId: ADMIN,
      actor: null,
      fromStatus: "pending",
      toStatus: "approved",
    });
  });

  it("filters by event type, searches by mod or player, and paginates", async () => {
    const workshop = await seedWorkshop(ctx);
    const alphaId = await seedProject(ctx, "Alpha Tools");
    const betaId = await seedProject(ctx, "Beta Blocks");
    await seedActor();

    const alpha = await workshopSuggestionService.suggestMod(
      workshop.id,
      ACTOR,
      {
        projectId: alphaId,
      },
    );
    const beta = await workshopSuggestionService.suggestMod(
      workshop.id,
      USER_B,
      {
        projectId: betaId,
      },
    );
    await workshopReviewService.reviewMod(alpha.id, "approve", ADMIN);
    await vi.waitFor(async () => {
      expect(await modEvents(alpha.id)).toHaveLength(2);
      expect(await modEvents(beta.id)).toHaveLength(1);
    });

    const approved = await workshopService.getWorkshopEvents(workshop.id, {
      eventType: "approved",
      limit: 10,
      offset: 0,
    });
    expect(approved.total).toBe(1);
    expect(approved.events[0]?.project.name).toBe("Alpha Tools");

    const byMod = await workshopService.getWorkshopEvents(workshop.id, {
      search: "beta",
      limit: 10,
      offset: 0,
    });
    expect(byMod.total).toBe(1);
    expect(byMod.events[0]?.workshopModId).toBe(beta.id);

    const byPlayer = await workshopService.getWorkshopEvents(workshop.id, {
      search: "vitest_act",
      limit: 10,
      offset: 0,
    });
    expect(byPlayer.total).toBe(1);
    expect(byPlayer.events[0]).toMatchObject({
      eventType: "suggested",
      workshopModId: alpha.id,
    });

    const secondPage = await workshopService.getWorkshopEvents(workshop.id, {
      limit: 2,
      offset: 2,
    });
    expect(secondPage.total).toBe(3);
    expect(secondPage.events).toHaveLength(1);
  });

  it("keeps withdrawn suggestions in the timeline without a live row", async () => {
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

    const { events } = await workshopService.getWorkshopEvents(workshop.id, {
      limit: 10,
      offset: 0,
    });
    expect(events.map((event) => event.eventType)).toEqual([
      "withdrawn",
      "suggested",
    ]);
    expect(events.every((event) => !event.modExists)).toBe(true);
  });

  it("throws NotFoundError for an unknown workshop", async () => {
    await expect(
      workshopService.getWorkshopEvents(0, { limit: 10, offset: 0 }),
    ).rejects.toThrow(NotFoundError);
  });
});
