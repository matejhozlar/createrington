import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";

vi.mock("@/services/workshop/discord", async () =>
  (
    await import("@/tests/helpers/mocks/workshop-discord")
  ).workshopDiscordMock(),
);
vi.mock("@/services/curseforge/mods", async () =>
  (await import("@/tests/helpers/mocks/curseforge")).curseforgeMocks.mods(),
);
vi.mock("@/services/curseforge/files", async () =>
  (await import("@/tests/helpers/mocks/curseforge")).curseforgeMocks.files(),
);
vi.mock("@/services/curseforge/modpack", async () =>
  (await import("@/tests/helpers/mocks/curseforge")).curseforgeMocks.modpack(),
);
vi.mock("@/services/modpack/manifest", async () =>
  (
    await import("@/tests/helpers/mocks/curseforge")
  ).curseforgeMocks.modpackManifest(),
);
vi.mock("@/services/curseforge/ingest", async () =>
  (await import("@/tests/helpers/mocks/curseforge")).curseforgeMocks.ingest(),
);
vi.mock("@/services/modpack/changelog", async () =>
  (await import("@/tests/helpers/mocks/modpack")).modpackChangelogMock(),
);
vi.mock("@/services/launcher/pack/pack-release.service", async () =>
  (
    await import("@/tests/helpers/mocks/launcher-pack")
  ).launcherPackMocks.releaseService(),
);
vi.mock("@/services/launcher/pack/sandbox-files", async () =>
  (
    await import("@/tests/helpers/mocks/launcher-pack")
  ).launcherPackMocks.sandboxFiles(),
);

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
