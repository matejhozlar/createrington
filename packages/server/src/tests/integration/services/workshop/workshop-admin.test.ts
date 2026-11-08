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
import { BadRequestError, ConflictError } from "@/app/middleware/error-handler";
import { workshopAdminService } from "@/services/workshop/admin.service";
import { ingestProject, ingestProjects } from "@/services/curseforge/ingest";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedMod,
  seedPackMod,
  makeProjectData,
  GAME_VERSION,
  MOD_LOADER_TYPE,
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

describe("WorkshopAdminService.createWorkshop", () => {
  const baseInput = () => ({
    name: "Vitest Created Workshop",
    slug: `vitest-created-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    gameVersion: GAME_VERSION,
    modLoaderType: MOD_LOADER_TYPE,
  });

  it("creates the workshop and a new modpack together when given a name", async () => {
    const workshop = await workshopAdminService.createWorkshop(
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
      workshopAdminService.createWorkshop(
        { ...baseInput(), modpackId: modpack.id, newModpackName: "Nope" },
        ADMIN,
      ),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects when neither an existing modpack nor a new name is provided", async () => {
    await expect(
      workshopAdminService.createWorkshop(baseInput(), ADMIN),
    ).rejects.toThrow(BadRequestError);
  });

  it("leaves no modpack behind when the slug is already taken", async () => {
    const existing = await seedWorkshop(ctx);

    await expect(
      workshopAdminService.createWorkshop(
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

describe("WorkshopAdminService.updateWorkshop", () => {
  it("rejects illegal status transitions", async () => {
    const workshop = await seedWorkshop(ctx, { status: "draft" });

    for (const status of ["closed", "archived"] as const) {
      await expect(
        workshopAdminService.updateWorkshop(workshop.id, { status }),
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
      const updated = await workshopAdminService.updateWorkshop(workshop.id, {
        status,
      });
      expect(updated.status).toBe(status);
    }
  });

  it("blocks reopening an archived workshop directly", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });

    for (const status of ["draft", "open"] as const) {
      await expect(
        workshopAdminService.updateWorkshop(workshop.id, { status }),
      ).rejects.toThrow(BadRequestError);
    }
  });

  it("renames the slug", async () => {
    const workshop = await seedWorkshop(ctx);
    const nextSlug = `${workshop.slug}-renamed`;

    const updated = await workshopAdminService.updateWorkshop(workshop.id, {
      slug: nextSlug,
    });
    expect(updated.slug).toBe(nextSlug);

    const persisted = await Q.workshop.get({ id: workshop.id });
    expect(persisted.slug).toBe(nextSlug);
  });

  it("accepts an unchanged slug", async () => {
    const workshop = await seedWorkshop(ctx);

    const updated = await workshopAdminService.updateWorkshop(workshop.id, {
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
      workshopAdminService.updateWorkshop(workshop.id, { slug: other.slug }),
    ).rejects.toThrow(ConflictError);

    const unchanged = await Q.workshop.get({ id: workshop.id });
    expect(unchanged.slug).toBe(workshop.slug);
  });
});

describe("WorkshopAdminService.deleteWorkshop", () => {
  it("refuses a workshop that is not archived", async () => {
    const workshop = await seedWorkshop(ctx, { status: "open" });

    await expect(
      workshopAdminService.deleteWorkshop(workshop.id),
    ).rejects.toThrow(BadRequestError);

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

    await workshopAdminService.deleteWorkshop(workshop.id);

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

    await workshopAdminService.deleteWorkshop(workshop.id);

    expect(await Q.workshop.poll.find({ id: poll.id })).toBeNull();
    expect(await Q.workshop.poll.mod.find({ id: pollMod.id })).toBeNull();
    expect(await Q.workshop.poll.ballot.find({ id: ballot.id })).toBeNull();
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
