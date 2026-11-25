import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  beforeEach,
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

import pool, { Q } from "@/db";
import { BadRequestError, NotFoundError } from "@/errors";
import { modpackPublishService } from "@/services/modpack/publish.service";
import { modpackReleaseService } from "@/services/modpack/release.service";
import { getModpackFile } from "@/services/curseforge/modpack";
import { getModpackManifest } from "@/services/modpack/manifest";
import { launcherPackReleaseService } from "@/services/launcher/pack/pack-release.service";
import { findSandboxSnapshotUrl } from "@/services/launcher/pack/sandbox-files";
import { ingestProjectsWhere } from "@/services/curseforge/ingest";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedWorkshop,
  seedMod,
  seedProject,
} from "@/tests/helpers/workshop";
import {
  cleanupLauncherPacks,
  seedLauncherPack,
} from "@/tests/helpers/launcher-pack";
import { manifest, sidedManifest, fileIdFor } from "@/tests/helpers/modpack";
import { curseforgeFile } from "@/tests/helpers/curseforge-file";

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

describe("ModpackPublishService.recordPublish", () => {
  const CLIENT = 8_710_127;
  const SERVER = 8_710_134;

  function serveReportedPair(projectId: number) {
    vi.mocked(getModpackFile).mockImplementation(async (_project, fileId) =>
      fileId === CLIENT
        ? curseforgeFile({ id: CLIENT, projectId })
        : fileId === SERVER
          ? curseforgeFile({
              id: SERVER,
              projectId,
              parentProjectFileId: CLIENT,
            })
          : null,
    );
  }

  it("stores the reported pair, forces a reconcile and ships a server-only suggestion", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    const workshop = await seedWorkshop(ctx, { modpackId: modpack.id });
    const serverOnly = await seedMod(ctx, workshop, {
      submittedBy: USER_A,
      status: "next_update",
    });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue({
      ...sidedManifest("0.6.3", [[serverOnly.curseforgeProjectId, "server"]]),
      fileId: CLIENT,
      serverPackFileId: SERVER,
    });

    const result = await modpackPublishService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(result).toMatchObject({ ingested: true, error: null });
    expect(getModpackManifest).toHaveBeenCalledWith(projectId, {
      force: true,
    });
    const publish = await Q.modpack.publish.get({
      modpackId: modpack.id,
      clientFileId: CLIENT,
    });
    expect(publish).toMatchObject({
      serverPackFileId: SERVER,
      lastError: null,
    });
    expect(publish.ingestedAt).not.toBeNull();
    expect(await Q.modpack.get({ id: modpack.id })).toMatchObject({
      shipsServerPack: true,
    });
    expect(await Q.workshop.mod.get({ id: serverOnly.id })).toMatchObject({
      status: "in_pack",
    });
    expect(
      await Q.modpack.mod.find({
        modpackId: modpack.id,
        curseforgeProjectId: serverOnly.curseforgeProjectId,
      }),
    ).toMatchObject({
      origin: "suggestion",
      workshopModId: serverOnly.id,
      liveInVersion: "0.6.3",
    });
    const [release] = await modpackReleaseService.listReleases(modpack.id);
    expect(release).toMatchObject({
      curseforgeFileId: CLIENT,
      serverPackFileId: SERVER,
      modCount: 1,
    });
  });

  it("is idempotent per client file and refreshes the report on a resend", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue({
      ...manifest({ version: "0.6.3" }),
      fileId: CLIENT,
      serverPackFileId: SERVER,
    });

    await modpackPublishService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });
    await modpackPublishService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(await Q.modpack.publish.count({ modpackId: modpack.id })).toBe(1);
  });

  it("comes back not ingested with the reason when CurseForge lists a newer file than the reported one", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue({
      ...manifest({ version: "0.6.4" }),
      fileId: CLIENT + 10,
      serverPackFileId: SERVER + 10,
    });

    const result = await modpackPublishService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(result.ingested).toBe(false);
    expect(result.error).toContain(`file ${CLIENT + 10} as newer`);
    const publish = await Q.modpack.publish.get({
      modpackId: modpack.id,
      clientFileId: CLIENT,
    });
    expect(publish.ingestedAt).toBeNull();
    expect(publish.lastError).toContain(`file ${CLIENT + 10} as newer`);
  });

  it("keeps the report and returns the refusal when the forced reconcile is refused", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    serveReportedPair(projectId);
    vi.mocked(getModpackManifest).mockResolvedValue(
      manifest({ version: "0.6.3", fileId: CLIENT }),
    );

    const result = await modpackPublishService.recordPublish({
      projectId,
      clientFileId: CLIENT,
      serverPackFileId: SERVER,
    });

    expect(result.ingested).toBe(false);
    expect(result.error).toContain("without a server pack");
    const publish = await Q.modpack.publish.get({
      modpackId: modpack.id,
      clientFileId: CLIENT,
    });
    expect(publish.ingestedAt).toBeNull();
    expect(publish.lastError).toContain("without a server pack");
  });

  it("refuses a server pack that is not an additional file of the client file", async () => {
    const projectId = ctx.nextProjectId++;
    const modpack = await seedModpack(ctx, { curseforgeProjectId: projectId });
    vi.mocked(getModpackFile).mockImplementation(async (_project, fileId) =>
      curseforgeFile({
        id: fileId,
        projectId,
        parentProjectFileId: fileId === SERVER ? CLIENT - 1 : null,
      }),
    );

    await expect(
      modpackPublishService.recordPublish({
        projectId,
        clientFileId: CLIENT,
        serverPackFileId: SERVER,
      }),
    ).rejects.toThrow(BadRequestError);

    expect(await Q.modpack.publish.count({ modpackId: modpack.id })).toBe(0);
    expect(getModpackManifest).not.toHaveBeenCalled();
  });

  it("refuses files CurseForge does not serve yet", async () => {
    const projectId = ctx.nextProjectId++;
    await seedModpack(ctx, { curseforgeProjectId: projectId });
    vi.mocked(getModpackFile).mockImplementation(async (_project, fileId) =>
      fileId === CLIENT ? curseforgeFile({ id: CLIENT, projectId }) : null,
    );

    await expect(
      modpackPublishService.recordPublish({
        projectId,
        clientFileId: CLIENT,
        serverPackFileId: SERVER,
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("throws NotFoundError when no modpack follows the project", async () => {
    await expect(
      modpackPublishService.recordPublish({
        projectId: 1,
        clientFileId: CLIENT,
        serverPackFileId: SERVER,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ModpackPublishService.recordSnapshot", () => {
  const SNAPSHOT_URL =
    "https://sandbox.createrington.test/api/pack/files/snapshot/7";

  async function seedSandboxPack() {
    const modpack = await seedModpack(ctx, { name: "Vitest Test Server" });
    await seedLauncherPack(ctx, {
      slug: "vitest-test",
      modpackId: modpack.id,
      source: "sandbox",
    });
    return modpack;
  }

  function report(projectId: number, overrides = {}) {
    return {
      slug: "vitest-test",
      snapshotId: 7,
      version: "1.4.2-test.7",
      minecraftVersion: "1.21.1",
      modLoader: "neoforge-21.1.249",
      zip: {
        fileName: "createrington-test-7.zip",
        size: 4321,
        sha1: "a".repeat(40),
      },
      files: [{ projectId, fileId: fileIdFor(projectId), required: true }],
      notes: "First test snapshot.",
      ...overrides,
    };
  }

  const BLOCKED_REASON =
    "1 client file(s) could not be resolved on CurseForge (file ids 700001)";

  function readyOnPrepare() {
    vi.mocked(launcherPackReleaseService.prepareSnapshot).mockImplementation(
      async (modpack, releaseId) => {
        await Q.modpack.release.updateAll(
          { launcherReadyAt: new Date() },
          { id: releaseId },
        );
        await Q.modpack.release.updateAll(
          { launcherUnavailableAt: new Date() },
          { modpackId: modpack.id, id: { $lt: releaseId } },
        );
        return { status: "ready" as const };
      },
    );
  }

  beforeEach(() => {
    vi.mocked(ingestProjectsWhere).mockResolvedValue(0);
    vi.mocked(findSandboxSnapshotUrl).mockResolvedValue(SNAPSHOT_URL);
    vi.mocked(launcherPackReleaseService.prepareSnapshot).mockResolvedValue({
      status: "blocked",
      reason: BLOCKED_REASON,
    });
  });

  it("records the verified snapshot as a release with its files and notes, readies it, and says so", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx, "Create");
    readyOnPrepare();

    const result = await modpackPublishService.recordSnapshot(
      report(projectId),
    );

    expect(findSandboxSnapshotUrl).toHaveBeenCalledWith({
      snapshotId: 7,
      sha1: "a".repeat(40),
      size: 4321,
    });
    expect(result.ready).toBe(true);
    expect(result.error).toBeNull();
    expect(result.release).toMatchObject({
      modpackId: modpack.id,
      curseforgeFileId: 7,
      serverPackFileId: null,
      version: "1.4.2-test.7",
      minecraftVersion: "1.21.1",
      modLoader: "neoforge-21.1.249",
      modCount: 1,
    });
    expect(launcherPackReleaseService.prepareSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: modpack.id }),
      result.release.id,
      {
        version: "1.4.2-test.7",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: {
          fileName: "createrington-test-7.zip",
          size: 4321,
          sha1: "a".repeat(40),
          downloadUrl: SNAPSHOT_URL,
        },
        entries: [{ projectId, fileId: fileIdFor(projectId), required: true }],
      },
    );
    const mods = await Q.modpack.release.mod.findAll({
      releaseId: result.release.id,
    });
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({
      curseforgeProjectId: projectId,
      fileId: fileIdFor(projectId),
      inClientPack: true,
    });
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({
      serverPackFileId: null,
      notes: "First test snapshot.",
      lastError: null,
    });
  });

  it("refuses a slug that is not a sandbox pack, and asks the sandbox nothing", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: 992_800_001,
    });
    await seedLauncherPack(ctx, {
      slug: "vitest-main",
      modpackId: modpack.id,
      source: "curseforge",
    });
    const projectId = await seedProject(ctx);

    await expect(
      modpackPublishService.recordSnapshot(
        report(projectId, { slug: "vitest-main" }),
      ),
    ).rejects.toThrow(NotFoundError);
    await expect(
      modpackPublishService.recordSnapshot(
        report(projectId, { slug: "vitest-none" }),
      ),
    ).rejects.toThrow(NotFoundError);
    expect(findSandboxSnapshotUrl).not.toHaveBeenCalled();
  });

  it("refuses a snapshot the sandbox does not serve as reported, and records nothing", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);
    vi.mocked(findSandboxSnapshotUrl).mockResolvedValue(null);

    await expect(
      modpackPublishService.recordSnapshot(report(projectId)),
    ).rejects.toThrow(BadRequestError);

    expect(await Q.modpack.release.count({ modpackId: modpack.id })).toBe(0);
    expect(launcherPackReleaseService.prepareSnapshot).not.toHaveBeenCalled();
  });

  it("keeps a snapshot that could not be readied and finishes it on a resend", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);

    const first = await modpackPublishService.recordSnapshot(report(projectId));
    readyOnPrepare();
    const second = await modpackPublishService.recordSnapshot(
      report(projectId, { notes: "" }),
    );

    expect(first.ready).toBe(false);
    expect(first.error).toBe(BLOCKED_REASON);
    expect(second.ready).toBe(true);
    expect(second.release.id).toBe(first.release.id);
    expect(await Q.modpack.release.count({ modpackId: modpack.id })).toBe(1);
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({ notes: null, lastError: null });
  });

  function cacheOnIngest() {
    vi.mocked(ingestProjectsWhere).mockImplementation(async (projectIds) => {
      for (const id of projectIds) {
        await Q.curseforge.project.create({
          id,
          classId: 6,
          slug: `vitest-mod-${id}`,
          name: `Vitest Mod ${id}`,
        });
      }
      return projectIds.length;
    });
  }

  function uncachedProjectId(): number {
    const id = ctx.nextProjectId++;
    ctx.projectIds.push(id);
    return id;
  }

  function twoFileReport(known: number, fresh: number) {
    return report(known, {
      files: [known, fresh].map((projectId) => ({
        projectId,
        fileId: fileIdFor(projectId),
        required: true,
      })),
    });
  }

  it("caches the projects of a snapshot it does not know yet before freezing its files", async () => {
    await seedSandboxPack();
    const known = await seedProject(ctx);
    const fresh = uncachedProjectId();
    cacheOnIngest();

    const result = await modpackPublishService.recordSnapshot(
      twoFileReport(known, fresh),
    );

    expect(ingestProjectsWhere).toHaveBeenCalledWith(
      [fresh],
      expect.any(Function),
    );
    expect(result.release.modCount).toBe(2);
    const mods = await Q.modpack.release.mod.findAll({
      releaseId: result.release.id,
    });
    expect(mods.map((mod) => mod.curseforgeProjectId).sort()).toEqual(
      [known, fresh].sort(),
    );
  });

  it("records a snapshot with its cached projects while CurseForge cannot be asked about the others", async () => {
    const modpack = await seedSandboxPack();
    const known = await seedProject(ctx);
    const fresh = uncachedProjectId();
    vi.mocked(ingestProjectsWhere).mockRejectedValue(
      new Error("CurseForge 503"),
    );

    const result = await modpackPublishService.recordSnapshot(
      twoFileReport(known, fresh),
    );

    expect(result.release.modCount).toBe(1);
    expect(result.error).toBe(BLOCKED_REASON);
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({ notes: "First test snapshot." });
  });

  it("refreezes the files of a snapshot not offered yet when a resend can cache a project it missed", async () => {
    await seedSandboxPack();
    const known = await seedProject(ctx);
    const fresh = uncachedProjectId();

    const first = await modpackPublishService.recordSnapshot(
      twoFileReport(known, fresh),
    );
    cacheOnIngest();
    const second = await modpackPublishService.recordSnapshot(
      twoFileReport(known, fresh),
    );

    expect(first.release.modCount).toBe(1);
    expect(second.release.id).toBe(first.release.id);
    expect(second.release.modCount).toBe(2);
    expect(
      await Q.modpack.release.mod.count({ releaseId: first.release.id }),
    ).toBe(2);
  });

  it("answers a ready snapshot as it is without asking the sandbox again", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);
    readyOnPrepare();
    const first = await modpackPublishService.recordSnapshot(report(projectId));
    vi.mocked(findSandboxSnapshotUrl).mockClear();
    vi.mocked(launcherPackReleaseService.prepareSnapshot).mockClear();

    const again = await modpackPublishService.recordSnapshot(report(projectId));

    expect(again.ready).toBe(true);
    expect(again.release.id).toBe(first.release.id);
    expect(findSandboxSnapshotUrl).not.toHaveBeenCalled();
    expect(launcherPackReleaseService.prepareSnapshot).not.toHaveBeenCalled();
    expect(await Q.modpack.release.count({ modpackId: modpack.id })).toBe(1);
  });

  it("tells the sandbox the reason a snapshot is blocked, and keeps it on the publish row", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);

    const result = await modpackPublishService.recordSnapshot(
      report(projectId),
    );

    expect(result).toMatchObject({ ready: false, error: BLOCKED_REASON });
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({ lastError: BLOCKED_REASON, ingestedAt: null });
  });

  it("answers a report that arrives while an earlier one is still preparing as in progress, without touching the publish row", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);
    vi.mocked(launcherPackReleaseService.prepareSnapshot).mockResolvedValue({
      status: "busy",
    });

    const result = await modpackPublishService.recordSnapshot(
      report(projectId),
    );

    expect(result.ready).toBe(false);
    expect(result.error).toMatch(/being prepared/);
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({ lastError: null, ingestedAt: null });
  });

  it("updates the notes of a ready snapshot on a resend", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);
    readyOnPrepare();
    await modpackPublishService.recordSnapshot(report(projectId));
    vi.mocked(findSandboxSnapshotUrl).mockClear();

    const again = await modpackPublishService.recordSnapshot(
      report(projectId, { notes: "Corrected notes." }),
    );
    const kept = await modpackPublishService.recordSnapshot(
      report(projectId, { notes: undefined }),
    );

    expect(again.ready).toBe(true);
    expect(kept.ready).toBe(true);
    expect(findSandboxSnapshotUrl).not.toHaveBeenCalled();
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({ notes: "Corrected notes." });
  });

  it("does not offer a snapshot older than the one already offered, and says so", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);
    readyOnPrepare();
    const seven = await modpackPublishService.recordSnapshot(report(projectId));
    const eight = await modpackPublishService.recordSnapshot(
      report(projectId, { snapshotId: 8 }),
    );
    vi.mocked(findSandboxSnapshotUrl).mockClear();
    vi.mocked(launcherPackReleaseService.prepareSnapshot).mockClear();

    const sevenAgain = await modpackPublishService.recordSnapshot(
      report(projectId),
    );
    const six = await modpackPublishService.recordSnapshot(
      report(projectId, { snapshotId: 6 }),
    );

    expect(seven.ready).toBe(true);
    expect(eight.ready).toBe(true);
    expect(sevenAgain).toMatchObject({
      ready: false,
      error: expect.stringMatching(/newer snapshot/),
    });
    expect(sevenAgain.release.id).toBe(seven.release.id);
    expect(six).toMatchObject({
      ready: false,
      error: expect.stringMatching(/Snapshot 8 is newer/),
    });
    expect(findSandboxSnapshotUrl).not.toHaveBeenCalled();
    expect(launcherPackReleaseService.prepareSnapshot).not.toHaveBeenCalled();
    expect(await Q.modpack.release.count({ modpackId: modpack.id })).toBe(2);
  });

  it("keeps the recorded release when prepareSnapshot throws, and reports the failure", async () => {
    const modpack = await seedSandboxPack();
    const projectId = await seedProject(ctx);
    vi.mocked(launcherPackReleaseService.prepareSnapshot).mockRejectedValue(
      new Error("CurseForge 504"),
    );

    const result = await modpackPublishService.recordSnapshot(
      report(projectId),
    );

    expect(result.ready).toBe(false);
    expect(result.error).toBe("CurseForge 504");
    expect(await Q.modpack.release.count({ modpackId: modpack.id })).toBe(1);
    expect(
      await Q.modpack.publish.get({ modpackId: modpack.id, clientFileId: 7 }),
    ).toMatchObject({ lastError: "CurseForge 504", ingestedAt: null });
  });
});
