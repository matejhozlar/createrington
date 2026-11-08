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

vi.mock("@/services/launcher/pack/pack-release.service", () => ({
  launcherPackReleaseService: {
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

import pool from "@/db";
import { modpackService } from "@/services/modpack/modpack.service";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedMod,
  seedPackMod,
  seedProject,
  seedRequiredDependency,
} from "@/tests/helpers/workshop";
import {
  cleanupLauncherPacks,
  seedLauncherPack,
} from "@/tests/helpers/launcher-pack";

const USER_A = "999900000000000002";

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

describe("ModpackService.listModpacks", () => {
  it("names the launcher pack offering a modpack, and null for the rest", async () => {
    const offered = await seedModpack(ctx, {
      curseforgeProjectId: 992_700_011,
    });
    const plain = await seedModpack(ctx);
    await seedLauncherPack(ctx, {
      slug: "vitest-listed",
      modpackId: offered.id,
      source: "curseforge",
    });

    const rows = await modpackService.listModpacks();
    const slugById = new Map(rows.map((row) => [row.id, row.launcherPackSlug]));

    expect(slugById.get(offered.id)).toBe("vitest-listed");
    expect(slugById.get(plain.id)).toBeNull();
  });

  it("counts members and live members per modpack, zero for an empty one", async () => {
    const workshop = await seedWorkshop(ctx);
    const empty = await seedModpack(ctx);
    await seedPackMod(ctx, workshop, { liveAt: new Date() });
    await seedPackMod(ctx, workshop, { liveAt: new Date() });
    await seedPackMod(ctx, workshop);

    const rows = await modpackService.listModpacks();
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(byId.get(workshop.modpackId)).toMatchObject({
      modCount: 3,
      liveCount: 2,
    });
    expect(byId.get(empty.id)).toMatchObject({ modCount: 0, liveCount: 0 });
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

  it("names a requiring member once when two workshops of the pack hold the same edge", async () => {
    const modpack = await seedModpack(ctx);
    const first = await seedWorkshop(ctx, { modpackId: modpack.id });
    const second = await seedWorkshop(ctx, { modpackId: modpack.id });
    const subject = await seedPackMod(ctx, first);
    const pulled = await seedPackMod(ctx, first, { origin: "dependency" });
    const outsider = await seedProject(ctx);
    for (const workshop of [first, second]) {
      await seedRequiredDependency(
        workshop,
        subject.curseforgeProjectId,
        pulled.curseforgeProjectId,
      );
    }
    await seedRequiredDependency(second, outsider, pulled.curseforgeProjectId);

    const rows = await modpackService.getPackMods(modpack.id);

    expect(rows.find((row) => row.id === pulled.id)?.requiredBy).toEqual([
      {
        curseforgeProjectId: subject.curseforgeProjectId,
        name: `Vitest Mod ${subject.curseforgeProjectId}`,
      },
    ]);
  });
});
