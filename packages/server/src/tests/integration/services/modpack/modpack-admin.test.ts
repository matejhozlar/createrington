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
vi.mock("@/services/curseforge/modpack-manifest", async () =>
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

import pool, { Q } from "@/db";
import { ConflictError, NotFoundError } from "@/app/middleware/error-handler";
import { modpackAdminService } from "@/services/modpack/admin.service";
import { workshopAdminService } from "@/services/workshop/admin.service";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedPackMod,
} from "@/tests/helpers/workshop";
import {
  cleanupLauncherPacks,
  seedLauncherPack,
} from "@/tests/helpers/launcher-pack";

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

describe("ModpackAdminService.deleteModpack", () => {
  it("throws NotFoundError for a modpack that does not exist", async () => {
    await expect(modpackAdminService.deleteModpack(99_999_999)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("refuses while any workshop uses it, archived included", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });

    await expect(
      modpackAdminService.deleteModpack(workshop.modpackId),
    ).rejects.toThrow(ConflictError);

    expect(await Q.modpack.find({ id: workshop.modpackId })).not.toBeNull();
  });

  it("refuses while the launcher offers it, and names the pack", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: 992_700_001,
    });
    await seedLauncherPack(ctx, {
      slug: "vitest-offered",
      modpackId: modpack.id,
      source: "curseforge",
    });

    await expect(modpackAdminService.deleteModpack(modpack.id)).rejects.toThrow(
      /"vitest-offered"/,
    );

    expect(await Q.modpack.find({ id: modpack.id })).not.toBeNull();
  });

  it("deletes members and releases once no workshop uses it", async () => {
    const workshop = await seedWorkshop(ctx, { status: "archived" });
    const member = await seedPackMod(ctx, workshop);
    const release = await Q.modpack.release.createAndReturn({
      modpackId: workshop.modpackId,
      curseforgeFileId: 640_001,
      modCount: 1,
    });

    await workshopAdminService.deleteWorkshop(workshop.id);
    await modpackAdminService.deleteModpack(workshop.modpackId);

    expect(await Q.modpack.find({ id: workshop.modpackId })).toBeNull();
    expect(await Q.modpack.mod.find({ id: member.id })).toBeNull();
    expect(await Q.modpack.release.find({ id: release.id })).toBeNull();
  });
});

describe("ModpackAdminService.updateModpack for a modpack the launcher offers", () => {
  async function seedOffered() {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: 992_700_002,
    });
    await seedLauncherPack(ctx, {
      slug: "vitest-offered",
      modpackId: modpack.id,
      source: "curseforge",
    });
    return modpack;
  }

  it("refuses to unlink its CurseForge project", async () => {
    const modpack = await seedOffered();

    await expect(
      modpackAdminService.updateModpack(modpack.id, {
        curseforgeProjectId: null,
      }),
    ).rejects.toThrow(ConflictError);

    expect((await Q.modpack.get({ id: modpack.id })).curseforgeProjectId).toBe(
      992_700_002,
    );
  });

  it("refuses to link another CurseForge project", async () => {
    const modpack = await seedOffered();

    await expect(
      modpackAdminService.updateModpack(modpack.id, {
        curseforgeProjectId: 992_700_003,
      }),
    ).rejects.toThrow(/"vitest-offered"/);
  });

  it("keeps every other field editable", async () => {
    const modpack = await seedOffered();

    const updated = await modpackAdminService.updateModpack(modpack.id, {
      name: "Renamed Pack",
      curseforgeProjectId: 992_700_002,
    });

    expect(updated.name).toBe("Renamed Pack");
    expect(updated.curseforgeProjectId).toBe(992_700_002);
  });

  it("lets a modpack the launcher does not offer unlink its project", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: 992_700_004,
    });

    const updated = await modpackAdminService.updateModpack(modpack.id, {
      curseforgeProjectId: null,
    });

    expect(updated.curseforgeProjectId).toBeNull();
  });
});
