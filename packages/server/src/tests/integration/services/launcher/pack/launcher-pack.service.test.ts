import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/curseforge/files", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/files")>();
  return {
    ...actual,
    getFilesDetails: vi.fn(async () => []),
    getServedFileIds: vi.fn(async (fileIds: number[]) => new Set(fileIds)),
  };
});
vi.mock("@/services/curseforge/modpack", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/modpack")>();
  return { ...actual, getModpackFile: vi.fn(async () => null) };
});
vi.mock("@/services/curseforge/downloads", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/curseforge/downloads")>();
  return { ...actual, resolveFileDownloads: vi.fn(async () => new Map()) };
});
vi.mock("@/services/curseforge/ingest", () => ({
  ingestProjectsWhere: vi.fn(async () => 0),
  refreshProjects: vi.fn(async () => 0),
}));
vi.mock("@/services/launcher/pack/sandbox-files", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/launcher/pack/sandbox-files")
  >()),
  findSandboxFileUrls: vi.fn(async () => new Map()),
  findSandboxSnapshotUrl: vi.fn(async () => null),
  openSandboxFile: vi.fn(async () => null),
}));
vi.mock("@/services/content-gateway/minecraft", () => ({
  getMinecraftJavaMajorVersion: vi.fn(async () => 21),
}));

import { Q } from "@/db";
import { getFilesDetails, getServedFileIds } from "@/services/curseforge/files";
import { refreshProjects } from "@/services/curseforge/ingest";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { launcherPackReleaseService } from "@/services/launcher/pack/pack-release.service";
import { LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE } from "@createrington/shared/launcher";
import { seedModpack } from "@/tests/helpers/workshop";
import {
  PACK_PROJECT_ID,
  PACK_SLUG,
  FIRST_PAGE,
  PACK_ON_CURSEFORGE,
  ctx,
  seedFile,
  serveFromCurseForge,
  seedRelease,
  seedReadyRelease,
  archivedOnCurseForge,
  listedVersions,
  packProject,
  seedPackProject,
  offerToLauncher,
  seedPack,
  seedPackWithoutProject,
  refusal,
  isReady,
  useLauncherPackTestHooks,
} from "@/tests/helpers/launcher-pack-harness";

useLauncherPackTestHooks();

describe("LauncherPackService.listPacks", () => {
  it("lists the enabled packs in the owner's order, each with its newest ready release", async () => {
    const main = await seedPack({}, { position: 2 });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(main, "1.0.0", [file]);
    await seedReadyRelease(main, "1.1.0", [file]);
    const serverId = (await Q.server.getAll({ limit: 1 }))[0]?.id ?? null;
    const test = await seedModpack(ctx, {
      name: "Vitest Test Server",
      description: "Where the next release is tried",
      serverId,
    });
    await offerToLauncher(test, {
      slug: "vitest-test",
      source: "sandbox",
      position: 1,
    });
    const hidden = await seedModpack(ctx, { name: "Vitest Hidden" });
    await offerToLauncher(hidden, {
      slug: "vitest-hidden",
      source: "sandbox",
      enabled: false,
    });

    const packs = await launcherPackService.listPacks();

    expect(packs.map((pack) => pack.slug)).toEqual(["vitest-test", PACK_SLUG]);
    expect(packs[0]).toEqual({
      slug: "vitest-test",
      source: "sandbox",
      name: "Vitest Test Server",
      summary: "Where the next release is tried",
      iconUrl: null,
      server:
        serverId === null ? null : expect.objectContaining({ id: serverId }),
      latest: null,
    });
    expect(packs[1]).toMatchObject({
      slug: PACK_SLUG,
      source: "curseforge",
      name: PACK_ON_CURSEFORGE.name,
      summary: PACK_ON_CURSEFORGE.summary,
      iconUrl: PACK_ON_CURSEFORGE.thumbnailUrl,
      server: null,
    });
    expect(packs[1].latest).toEqual(
      await launcherPackService.getLatestPack(PACK_SLUG),
    );
    expect(packs[1].latest?.version).toBe("1.1.0");
  });

  it("describes a CurseForge pack from its modpack row while its project cannot be served, without a release", async () => {
    const modpack = await seedPackWithoutProject(PACK_PROJECT_ID + 12);
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockRejectedValue(new Error("CurseForge 504"));

    const packs = await launcherPackService.listPacks();

    expect(packs).toEqual([
      {
        slug: PACK_SLUG,
        source: "curseforge",
        name: "Vitest Pack",
        summary: null,
        iconUrl: null,
        server: null,
        latest: null,
      },
    ]);
  });

  it("lists a pack without a release with latest null", async () => {
    await seedPack();

    const [pack] = await launcherPackService.listPacks();

    expect(pack.name).toBe(PACK_ON_CURSEFORGE.name);
    expect(pack.latest).toBeNull();
  });
});

describe("LauncherPackService.getLatestPack", () => {
  it("answers PACK_UNAVAILABLE while no release is ready", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "1.0.0", [await seedFile()]);

    const error = await refusal(launcherPackService.getLatestPack(PACK_SLUG));

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_UNAVAILABLE");
  });

  it("serves the newest ready release", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    for (const version of ["1.0.0", "1.1.0"]) {
      const { release, manifest } = await seedRelease(modpack, version, [file]);
      await launcherPackReleaseService.prepareRelease(
        modpack,
        release.id,
        manifest,
      );
    }

    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.1.0",
    );
  });

  it("names the pack as CurseForge does, not as the app does", async () => {
    const modpack = await seedPack({
      name: "Rails 'n Sails",
      summary: null,
      thumbnailUrl: null,
      primaryAuthor: null,
    });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);

    const { project } = await launcherPackService.getLatestPack(PACK_SLUG);

    expect(modpack.name).toBe("Vitest Pack");
    expect(project).toEqual({
      ...packProject(),
      name: "Rails 'n Sails",
      summary: null,
      author: null,
      iconUrl: null,
    });
    expect(refreshProjects).not.toHaveBeenCalled();
  });

  it("stores the pack's project from CurseForge when it is not stored yet", async () => {
    const projectId = PACK_PROJECT_ID + 10;
    const modpack = await seedPackWithoutProject(projectId);
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockImplementation(async ([id]) => {
      await seedPackProject(id);
      return 1;
    });

    const [first, second] = await Promise.all([
      launcherPackService.getLatestPack(PACK_SLUG),
      launcherPackService.getLatestPack(PACK_SLUG),
    ]);

    expect(first.project).toEqual(packProject(projectId));
    expect(second).toEqual(first);
    expect(refreshProjects).toHaveBeenCalledTimes(1);
    expect(refreshProjects).toHaveBeenCalledWith([projectId]);
  });

  it("does not serve the pack while its project cannot be stored, and asks CurseForge once", async () => {
    const modpack = await seedPackWithoutProject(PACK_PROJECT_ID + 11);
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockRejectedValue(new Error("CurseForge 504"));

    const error = await refusal(launcherPackService.getLatestPack(PACK_SLUG));
    const listed = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_UNAVAILABLE");
    expect(listed).toEqual({ releases: [], total: 0 });
    expect(refreshProjects).toHaveBeenCalledTimes(1);
  });

  it("does not serve a pack whose CurseForge project is not a modpack", async () => {
    const modpack = await seedPack({ classId: 6 });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);

    const error = await refusal(launcherPackService.getLatestPack(PACK_SLUG));

    expect(error.code).toBe("PACK_UNAVAILABLE");
    expect(
      await launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE),
    ).toEqual({
      releases: [],
      total: 0,
    });
  });
});

describe("LauncherPackService.getLatestPack for a pack the launcher is not offered", () => {
  it("answers PACK_NOT_FOUND for a slug no pack carries", async () => {
    await seedPack();

    const error = await refusal(launcherPackService.getLatestPack("nope"));

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_NOT_FOUND");
  });

  it("answers PACK_NOT_FOUND for a pack the owner switched off, and lists no release of it", async () => {
    const modpack = await seedPack({}, { enabled: false });
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);

    const latest = await refusal(launcherPackService.getLatestPack(PACK_SLUG));
    const releases = await refusal(
      launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE),
    );

    expect(latest.code).toBe("PACK_NOT_FOUND");
    expect(releases.code).toBe("PACK_NOT_FOUND");
  });

  it("still prepares the releases of a pack the owner switched off", async () => {
    const modpack = await seedPack({}, { enabled: false });
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    await Q.launcher.pack.updateAll(
      { enabled: true },
      { modpackId: modpack.id },
    );

    expect(await isReady(release.id)).toBe(true);
    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.0.0",
    );
  });

  it("describes a pack whose releases the sandbox reports by its modpack row, never by CurseForge", async () => {
    const modpack = await seedModpack(ctx, {
      name: "Vitest Test Server",
      description: "Where the next release is tried",
      iconUrl: "https://assets.createrington.test/icons/test.png",
      curseforgeProjectId: PACK_PROJECT_ID + 3,
    });
    await offerToLauncher(modpack, { slug: "vitest-test", source: "sandbox" });

    const latest = await refusal(
      launcherPackService.getLatestPack("vitest-test"),
    );
    const listed = await launcherPackService.listReleases(
      "vitest-test",
      FIRST_PAGE,
    );
    const [summary] = await launcherPackService.listPacks();

    expect(latest.code).toBe("PACK_UNAVAILABLE");
    expect(listed).toEqual({ releases: [], total: 0 });
    expect(summary).toMatchObject({
      slug: "vitest-test",
      source: "sandbox",
      name: "Vitest Test Server",
      summary: "Where the next release is tried",
      iconUrl: "https://assets.createrington.test/icons/test.png",
      latest: null,
    });
    expect(refreshProjects).not.toHaveBeenCalled();
  });

  it("does not prepare the releases of a pack whose releases the sandbox reports", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 2,
    });
    await offerToLauncher(modpack, { slug: "vitest-test", source: "sandbox" });
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    await launcherPackReleaseService.checkReleases(modpack);

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(getServedFileIds).not.toHaveBeenCalled();
  });
});

describe("LauncherPackService.listReleases", () => {
  it("lists every ready release newest first, in the shape of the latest pack", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedRelease(modpack, "1.2.0", [file]);

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(releases.map((release) => release.version)).toEqual([
      "1.1.0",
      "1.0.0",
    ]);
    expect(releases[0]).toEqual({
      ...(await launcherPackService.getLatestPack(PACK_SLUG)),
      changelog: expect.any(Object),
    });
    expect(releases.map((release) => release.project)).toEqual([
      packProject(),
      packProject(),
    ]);
  });

  it("is empty while no release is ready", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "1.0.0", [await seedFile()]);

    expect(
      await launcherPackService.listReleases(PACK_SLUG, FIRST_PAGE),
    ).toEqual({
      releases: [],
      total: 0,
    });
  });

  it("serves the list in pages and counts only the releases it lists", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const archived = await seedReadyRelease(modpack, "0.9.0", [file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedReadyRelease(modpack, "1.2.0", [file]);
    await seedRelease(modpack, "1.3.0", [file]);
    archivedOnCurseForge([archived.manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    const first = await launcherPackService.listReleases(PACK_SLUG, {
      page: 0,
      limit: 2,
    });
    const second = await launcherPackService.listReleases(PACK_SLUG, {
      page: 1,
      limit: 2,
    });
    const pastTheEnd = await launcherPackService.listReleases(PACK_SLUG, {
      page: 5,
      limit: 2,
    });

    expect(first.releases.map((release) => release.version)).toEqual([
      "1.2.0",
      "1.1.0",
    ]);
    expect(first.total).toBe(3);
    expect(second.releases.map((release) => release.version)).toEqual([
      "1.0.0",
    ]);
    expect(pastTheEnd).toEqual({ releases: [], total: 3 });
  });

  it("answers the one installable release of the named version on the first page", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedReadyRelease(modpack, "1.2.0", [file]);

    const listed = await launcherPackService.listReleases(PACK_SLUG, {
      ...FIRST_PAGE,
      version: "1.1.0",
    });

    expect(listed.total).toBe(1);
    expect(listed.releases.map((release) => release.version)).toEqual([
      "1.1.0",
    ]);
    expect(await listedVersions()).toEqual(["1.2.0", "1.1.0", "1.0.0"]);
  });

  it("answers no release for a version the pack never carried or can no longer install", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    const archived = await seedReadyRelease(modpack, "1.1.0", [file]);
    await seedRelease(modpack, "1.2.0", [file]);
    archivedOnCurseForge([archived.manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    const byVersion = (version: string) =>
      launcherPackService.listReleases(PACK_SLUG, { ...FIRST_PAGE, version });

    expect(await byVersion("9.9.9")).toEqual({ releases: [], total: 0 });
    expect(await byVersion("1.1.0")).toEqual({ releases: [], total: 0 });
    expect(await byVersion("1.2.0")).toEqual({ releases: [], total: 0 });
    expect((await byVersion("1.0.0")).total).toBe(1);
  });

  it("serves a release that was recorded without a version once it is made ready", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);
    await Q.modpack.release.updateAll(
      { version: null, minecraftVersion: null, modLoader: null },
      { id: release.id },
    );

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    const listed = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(listed.total).toBe(1);
    expect(listed.releases).toEqual([
      expect.objectContaining({
        version: "1.0.0",
        minecraftVersion: "1.21.1",
        modLoader: expect.objectContaining({ id: "neoforge-21.1.249" }),
      }),
    ]);
  });

  it("diffs a full-size page in two reads and answers it from the changelog store the second time", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const fullPage = { page: 0, limit: LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE };
    for (let minor = 0; minor < fullPage.limit; minor++) {
      await seedReadyRelease(modpack, `1.${minor}.0`, [file]);
    }
    const previousReads = vi.spyOn(Q.modpack.release, "listPreceding");
    const modReads = vi.spyOn(Q.modpack.release.mod, "listForReleases");

    const first = await launcherPackService.listReleases(PACK_SLUG, fullPage);
    const readsForFirst = [
      previousReads.mock.calls.length,
      modReads.mock.calls.length,
    ];
    const second = await launcherPackService.listReleases(PACK_SLUG, fullPage);
    const readsForBoth = [
      previousReads.mock.calls.length,
      modReads.mock.calls.length,
    ];
    previousReads.mockRestore();
    modReads.mockRestore();

    expect(first.releases).toHaveLength(fullPage.limit);
    expect(readsForFirst).toEqual([1, 1]);
    expect(readsForBoth).toEqual([1, 1]);
    expect(second).toEqual(first);
  });

  it("gives each release the mods it added, updated and removed against the release before it", async () => {
    const modpack = await seedPack();
    const kept = await seedFile();
    const outdated = await seedFile();
    const updated = await seedFile({ newFileOf: outdated });
    const dropped = await seedFile();
    const fresh = await seedFile();
    serveFromCurseForge([kept, outdated, updated, dropped, fresh]);
    await seedReadyRelease(modpack, "1.0.0", [kept, outdated, dropped]);
    await seedReadyRelease(modpack, "1.1.0", [kept, updated, fresh]);

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(releases[0].changelog).toEqual({
      previousVersion: "1.0.0",
      added: [
        {
          projectId: fresh.projectId,
          name: expect.any(String),
          url: expect.stringContaining("curseforge.com"),
          iconUrl: null,
          label: `Mod ${fresh.fileId}`,
          previousLabel: null,
          disabled: false,
        },
      ],
      updated: [
        expect.objectContaining({
          projectId: updated.projectId,
          label: `Mod ${updated.fileId}`,
          previousLabel: `Mod ${outdated.fileId}`,
        }),
      ],
      removed: [
        expect.objectContaining({
          projectId: dropped.projectId,
          label: `Mod ${dropped.fileId}`,
          previousLabel: null,
        }),
      ],
      notes: null,
    });
    expect(releases[1].changelog).toEqual({
      previousVersion: null,
      added: [],
      updated: [],
      removed: [],
      notes: null,
    });
  });

  it("carries the notes written for a release", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { manifest } = await seedReadyRelease(modpack, "1.0.0", [file]);
    await Q.modpack.publish.create({
      modpackId: modpack.id,
      clientFileId: manifest.fileId,
      notes: "Trains are faster now.\nThe nether was reset.",
    });

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(releases[0].changelog.notes).toBe(
      "Trains are faster now.\nThe nether was reset.",
    );
  });

  it("compares a release with the one recorded before it even when that one is no longer listed", async () => {
    const modpack = await seedPack();
    const kept = await seedFile();
    const fresh = await seedFile();
    serveFromCurseForge([kept, fresh]);
    const old = await seedReadyRelease(modpack, "1.0.0", [kept]);
    await seedReadyRelease(modpack, "1.1.0", [kept, fresh]);
    archivedOnCurseForge([old.manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    const { releases } = await launcherPackService.listReleases(
      PACK_SLUG,
      FIRST_PAGE,
    );

    expect(releases.map((release) => release.version)).toEqual(["1.1.0"]);
    expect(releases[0].changelog).toEqual(
      expect.objectContaining({
        previousVersion: "1.0.0",
        added: [expect.objectContaining({ projectId: fresh.projectId })],
      }),
    );
  });
});
