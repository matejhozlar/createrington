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

import config from "@/config";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { getFilesDetails, getServedFileIds } from "@/services/curseforge/files";
import { resolveFileDownloads } from "@/services/curseforge/downloads";
import { refreshProjects } from "@/services/curseforge/ingest";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { launcherPackFileService } from "@/services/launcher/pack/pack-files.service";
import { launcherPackReleaseService } from "@/services/launcher/pack/pack-release.service";
import {
  findSandboxFileUrls,
  openSandboxFile,
  SandboxUnavailableError,
} from "@/services/launcher/pack/sandbox-files";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import { seedModpack } from "@/tests/helpers/workshop";
import {
  PACK_PROJECT_ID,
  PACK_SLUG,
  FIRST_PAGE,
  ctx,
  sha1Of,
  cdnUrl,
  modrinthUrl,
  builtCdnUrl,
  storageUrl,
  storageSnapshotUrl,
  type SeededFile,
  seedFile,
  serveFromCurseForge,
  serveFromModrinth,
  serveFromBuiltCdnAddress,
  sourcesCannotBeAsked,
  serveFromSandbox,
  useBuiltCdnAddress,
  packZip,
  seedRelease,
  seedReadyRelease,
  archivedOnCurseForge,
  listedVersions,
  packProject,
  offerToLauncher,
  seedPack,
  refusal,
  isReady,
  sendMock,
  useLauncherPackTestHooks,
} from "@/tests/helpers/launcher-pack-harness";

useLauncherPackTestHooks();

describe("LauncherPackReleaseService.prepareRelease", () => {
  it("makes a release ready and serves it as the latest pack", async () => {
    const modpack = await seedPack();
    const files = [await seedFile(), await seedFile()];
    serveFromCurseForge(files);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(await launcherPackService.getLatestPack(PACK_SLUG)).toEqual({
      project: packProject(),
      version: "1.0.0",
      releasedAt: "2026-10-01T10:00:00.000Z",
      minecraftVersion: "1.21.1",
      modLoader: {
        id: "neoforge-21.1.249",
        name: "neoforge",
        version: "21.1.249",
      },
      javaMajorVersion: 21,
      zip: {
        fileId: manifest.fileId,
        fileName: `vitest-pack-${manifest.fileId}.zip`,
        url: `https://edge.forgecdn.net/files/${manifest.fileId}/vitest-pack.zip`,
        size: 4_500_000,
        sha1: sha1Of(manifest.fileId),
        servedBy: "curseforge",
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stores each client file with its source, folder and CurseForge hash", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    await Q.curseforge.project.updateAll(
      {
        summary: "A synthetic test project",
        thumbnailUrl: "https://media.forgecdn.net/avatars/vitest.png",
        primaryAuthor: "vitest",
      },
      { id: served.projectId },
    );
    const onModrinth = await seedFile({ blocked: true });
    const shader = await seedFile({ classId: 6552, sides: "client" });
    const resourcePack = await seedFile({ classId: 12, sides: "client" });
    const files = [served, onModrinth, shader, resourcePack];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth, served]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    vi.mocked(getFilesDetails).mockClear();
    const resolved = await launcherPackFileService.resolveFiles(
      files.map((file) => file.fileId),
    );

    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(resolved.unresolvedFileIds).toEqual([]);
    expect(resolved.files).toEqual([
      {
        projectId: served.projectId,
        fileId: served.fileId,
        fileName: `mod-${served.fileId}.jar`,
        size: served.detail.fileLength,
        sha1: sha1Of(served.fileId),
        folder: "mods",
        source: "curseforge",
        url: cdnUrl(served.fileId),
        pageUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${served.fileId}/files/${served.fileId}`,
        file: {
          source: "curseforge",
          projectId: String(served.projectId),
          id: String(served.fileId),
          fileName: `mod-${served.fileId}.jar`,
          size: served.detail.fileLength,
          sha1: sha1Of(served.fileId),
          pageUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${served.fileId}/files/${served.fileId}`,
          download: { servedBy: "curseforge", url: cdnUrl(served.fileId) },
        },
        project: {
          source: "curseforge",
          id: String(served.projectId),
          slug: `vitest-mod-${served.projectId}`,
          kind: "mod",
          name: `Vitest Mod ${served.projectId}`,
          summary: "A synthetic test project",
          author: "vitest",
          iconUrl: "https://media.forgecdn.net/avatars/vitest.png",
          url: `https://www.curseforge.com/minecraft/mc-mods/vitest-${served.fileId}`,
        },
      },
      expect.objectContaining({
        fileId: onModrinth.fileId,
        sha1: sha1Of(onModrinth.fileId),
        folder: "mods",
        source: "modrinth",
        url: modrinthUrl(onModrinth.fileId),
        file: expect.objectContaining({
          source: "curseforge",
          id: String(onModrinth.fileId),
          download: {
            servedBy: "modrinth",
            url: modrinthUrl(onModrinth.fileId),
          },
        }),
        project: expect.objectContaining({
          source: "curseforge",
          id: String(onModrinth.projectId),
          summary: null,
          author: null,
          iconUrl: null,
        }),
      }),
      expect.objectContaining({
        fileId: shader.fileId,
        folder: "shaderpacks",
        source: "curseforge",
        project: expect.objectContaining({ kind: "shader" }),
      }),
      expect.objectContaining({
        fileId: resourcePack.fileId,
        folder: "resourcepacks",
        source: "curseforge",
        project: expect.objectContaining({ kind: "resourcepack" }),
      }),
    ]);
  });

  it("only asks the gateway to resolve files CurseForge blocks", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([served, blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      served,
      blocked,
    ]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(resolveFileDownloads).toHaveBeenCalledTimes(1);
    expect(resolveFileDownloads).toHaveBeenCalledWith([blocked.fileId], {
      cdn: false,
    });
  });

  it("tells the owner when a client file has no download source", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const manual = await seedFile({ blocked: true });
    const disabled = await seedFile({ blocked: true, required: false });
    const files = [served, manual, disabled];
    serveFromCurseForge(files);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(await isReady(release.id)).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const notice = sendMock.mock.calls[0][0];
    expect(notice.channelId).toBe(
      Discord.Channels.administration.NOTIFICATIONS,
    );
    expect(notice.content).toBe(`<@${config.app.auth.owner.discordId}>`);
    expect(notice.embeds.data.description).toContain("Vitest Pack 1.0.0");
    expect(notice.embeds.data.description).toContain(
      `mod-${manual.fileId}.jar`,
    );
    expect(notice.embeds.data.description).toContain(
      `\`mod-${disabled.fileId}.jar\` (ships disabled)`,
    );
    expect(notice.embeds.data.description).not.toContain(
      `mod-${served.fileId}.jar`,
    );

    const resolved = await launcherPackFileService.resolveFiles([
      manual.fileId,
    ]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: manual.fileId,
        source: "manual",
        url: null,
        sha1: sha1Of(manual.fileId),
        pageUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${manual.fileId}/files/${manual.fileId}`,
      }),
    ]);
  });

  it("hands out the sandbox copy of a file neither CDN serves, and asks the sandbox about nothing else", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const onModrinth = await seedFile({ blocked: true });
    const onSandbox = await seedFile({ blocked: true });
    const files = [served, onModrinth, onSandbox];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(findSandboxFileUrls).toHaveBeenCalledTimes(1);
    expect(findSandboxFileUrls).toHaveBeenCalledWith([
      {
        fileId: onSandbox.fileId,
        sha1: sha1Of(onSandbox.fileId),
        size: onSandbox.detail.fileLength,
      },
    ]);
    expect(sendMock).not.toHaveBeenCalled();
    const resolved = await launcherPackFileService.resolveFiles([
      onSandbox.fileId,
    ]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: onSandbox.fileId,
        source: "storage",
        url: storageUrl(onSandbox.fileId),
        sha1: sha1Of(onSandbox.fileId),
      }),
    ]);
  });

  it("hands out the built CDN address of a blocked file Modrinth lacks, and asks the sandbox only about what is left", async () => {
    await useBuiltCdnAddress(true);
    const modpack = await seedPack();
    const served = await seedFile();
    const onModrinth = await seedFile({ blocked: true });
    const onCdn = await seedFile({ blocked: true });
    const onSandbox = await seedFile({ blocked: true });
    const files = [served, onModrinth, onCdn, onSandbox];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth]);
    serveFromBuiltCdnAddress([onCdn, onModrinth, served]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(resolveFileDownloads).toHaveBeenCalledTimes(1);
    expect(resolveFileDownloads).toHaveBeenCalledWith(
      [onModrinth.fileId, onCdn.fileId, onSandbox.fileId],
      { cdn: true },
    );
    expect(findSandboxFileUrls).toHaveBeenCalledWith([
      expect.objectContaining({ fileId: onSandbox.fileId }),
    ]);
    expect(sendMock).not.toHaveBeenCalled();
    const resolved = await launcherPackFileService.resolveFiles(
      files.map((file) => file.fileId),
    );
    expect(resolved.files).toEqual([
      expect.objectContaining({ fileId: served.fileId, source: "curseforge" }),
      expect.objectContaining({
        fileId: onModrinth.fileId,
        source: "modrinth",
      }),
      expect.objectContaining({
        fileId: onCdn.fileId,
        source: "curseforge-cdn",
        url: builtCdnUrl(onCdn.fileId),
        sha1: sha1Of(onCdn.fileId),
      }),
      expect.objectContaining({ fileId: onSandbox.fileId, source: "storage" }),
    ]);
  });

  it("falls through to manual and tells the owner when the built address does not answer", async () => {
    await useBuiltCdnAddress(true);
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(resolveFileDownloads).toHaveBeenCalledWith([blocked.fileId], {
      cdn: true,
    });
    expect(await isReady(release.id)).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      `mod-${blocked.fileId}.jar`,
    );
    const resolved = await launcherPackFileService.resolveFiles([
      blocked.fileId,
    ]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: blocked.fileId,
        source: "manual",
        url: null,
      }),
    ]);
  });

  it("does not build an address while the source is switched off", async () => {
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    serveFromBuiltCdnAddress([blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(resolveFileDownloads).toHaveBeenCalledWith([blocked.fileId], {
      cdn: false,
    });
    const resolved = await launcherPackFileService.resolveFiles([
      blocked.fileId,
    ]);
    expect(resolved.files[0].source).toBe("manual");
  });

  it("checks a stored built address again when a release is prepared", async () => {
    await useBuiltCdnAddress(true);
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    serveFromBuiltCdnAddress([blocked]);
    await launcherPackFileService.resolveFiles([blocked.fileId]);
    serveFromBuiltCdnAddress([]);
    serveFromSandbox([blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    const resolved = await launcherPackFileService.resolveFiles([
      blocked.fileId,
    ]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: blocked.fileId,
        source: "storage",
        url: storageUrl(blocked.fileId),
      }),
    ]);
  });

  it("leaves files that only the server pack ships alone", async () => {
    const modpack = await seedPack();
    const client = await seedFile();
    const serverOnly = await seedFile({ blocked: true, sides: "server" });
    serveFromCurseForge([client, serverOnly]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      client,
      serverOnly,
    ]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(await isReady(release.id)).toBe(true);
    expect(getFilesDetails).toHaveBeenCalledWith([client.fileId]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("keeps offering the previous release while a newer one has a client file CurseForge does not know", async () => {
    const modpack = await seedPack();
    const known = await seedFile();
    const unknown = await seedFile();
    serveFromCurseForge([known]);
    const first = await seedRelease(modpack, "1.0.0", [known]);
    await launcherPackReleaseService.prepareRelease(
      modpack,
      first.release.id,
      first.manifest,
    );
    const second = await seedRelease(modpack, "1.1.0", [known, unknown]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      second.release.id,
      second.manifest,
    );
    await launcherPackReleaseService.prepareRelease(
      modpack,
      second.release.id,
      second.manifest,
    );

    expect(await isReady(second.release.id)).toBe(false);
    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.0.0",
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      String(unknown.fileId),
    );
  });

  it("becomes ready on a later attempt once the missing file resolves", async () => {
    const modpack = await seedPack();
    const late = await seedFile();
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [late]);
    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    expect(await isReady(release.id)).toBe(false);

    serveFromCurseForge([late]);
    packZip(manifest.fileId);
    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(await isReady(release.id)).toBe(true);
  });

  it("does not store a blocked file as manual while a source could not be asked about it", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([served, blocked]);
    sourcesCannotBeAsked();
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      served,
      blocked,
    ]);

    await expect(
      launcherPackReleaseService.prepareRelease(modpack, release.id, manifest),
    ).rejects.toThrow(/could not be asked/);

    expect(await isReady(release.id)).toBe(false);
    expect(await Q.curseforge.file.find({ id: blocked.fileId })).toBeNull();
    expect(await Q.curseforge.file.find({ id: served.fileId })).toMatchObject({
      source: "curseforge",
    });
    expect(findSandboxFileUrls).toHaveBeenCalledWith([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("is not ready when a file that was manual before cannot be looked up again", async () => {
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    await launcherPackFileService.resolveFiles([blocked.fileId]);
    vi.mocked(resolveFileDownloads).mockRejectedValue(
      new Error("the gateway answered 503"),
    );
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await expect(
      launcherPackReleaseService.prepareRelease(modpack, release.id, manifest),
    ).rejects.toThrow(/503/);

    expect(await isReady(release.id)).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("says so when a release is keyed by its server pack and cannot be offered", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);
    const clientRead = { ...manifest, fileId: manifest.fileId + 100_000 };

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      clientRead,
    );
    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      clientRead,
    );

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      "server pack",
    );
  });

  it.each([
    ["no download link", { downloadUrl: null }],
    ["no SHA-1", { sha1: null }],
  ])(
    "is not ready when CurseForge gives %s for the pack zip",
    async (_label, zip) => {
      const modpack = await seedPack();
      const file = await seedFile();
      serveFromCurseForge([file]);
      const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);
      packZip(manifest.fileId, zip);

      await launcherPackReleaseService.prepareRelease(
        modpack,
        release.id,
        manifest,
      );

      expect(await isReady(release.id)).toBe(false);
      expect(sendMock).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores a modpack the launcher does not install", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 1,
    });
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [file]);

    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
  });
});

describe("LauncherPackReleaseService.prepareSnapshot", () => {
  const SNAPSHOT_ZIP = {
    fileName: "createrington-test-7.zip",
    size: 4321,
    sha1: "a".repeat(40),
    downloadUrl: "https://sandbox.createrington.test/api/pack/files/snapshot/7",
  };

  async function seedSandboxPack(): Promise<Modpack> {
    const modpack = await seedModpack(ctx, {
      name: "Vitest Test Server",
      description: "Where the next release is tried",
      iconUrl: "https://assets.createrington.test/icons/test.png",
    });
    await offerToLauncher(modpack, { slug: "vitest-test", source: "sandbox" });
    return modpack;
  }

  async function seedSnapshot(
    modpack: Modpack,
    snapshotId: number,
    version: string,
    files: SeededFile[],
  ): Promise<ModpackRelease> {
    const release = await Q.modpack.release.createAndReturn({
      modpackId: modpack.id,
      curseforgeFileId: snapshotId,
      version,
      minecraftVersion: "1.21.1",
      modLoader: "neoforge-21.1.249",
      modCount: files.length,
      publishedAt: new Date(),
    });
    await Q.modpack.release.mod.insertMany(
      release.id,
      files.map((file) => ({
        curseforgeProjectId: file.projectId,
        fileId: file.fileId,
        fileName: file.detail.fileName,
        displayName: file.detail.displayName,
        fileReleaseType: file.detail.releaseType,
        fileDate: null,
        required: file.required,
        inClientPack: true,
      })),
    );
    return release;
  }

  const entriesOf = (files: SeededFile[]) =>
    files.map(({ projectId, fileId, required }) => ({
      projectId,
      fileId,
      required,
    }));

  it("readies a snapshot and serves it as the pack's latest release, described by the modpack row", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const release = await seedSnapshot(modpack, 7, "1.4.2-test.7", [file]);

    const outcome = await launcherPackReleaseService.prepareSnapshot(
      modpack,
      release.id,
      {
        version: "1.4.2-test.7",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      },
    );

    expect(outcome).toEqual({ status: "ready" });
    const latest = await launcherPackService.getLatestPack("vitest-test");
    expect(latest).toEqual({
      project: {
        source: "createrington",
        id: String(modpack.id),
        slug: "vitest-test",
        kind: "modpack",
        name: "Vitest Test Server",
        summary: "Where the next release is tried",
        author: null,
        iconUrl: "https://assets.createrington.test/icons/test.png",
        url: expect.stringMatching(/^https?:\/\//),
      },
      version: "1.4.2-test.7",
      releasedAt: expect.any(String),
      minecraftVersion: "1.21.1",
      modLoader: {
        id: "neoforge-21.1.249",
        name: "neoforge",
        version: "21.1.249",
      },
      javaMajorVersion: 21,
      zip: {
        fileId: 7,
        fileName: SNAPSHOT_ZIP.fileName,
        url: storageSnapshotUrl(7),
        size: SNAPSHOT_ZIP.size,
        sha1: SNAPSHOT_ZIP.sha1,
        servedBy: "storage",
      },
    });
    const [summary] = await launcherPackService.listPacks();
    expect(summary.latest).toEqual(latest);
    expect(getFilesDetails).toHaveBeenCalledWith([file.fileId]);
  });

  describe("openStorageSnapshot", () => {
    const stream = () => ({
      body: new Blob([Buffer.from("zip bytes")]).stream(),
      size: SNAPSHOT_ZIP.size,
    });

    async function readySnapshot(id: number): Promise<Modpack> {
      const modpack = await seedSandboxPack();
      const file = await seedFile();
      serveFromCurseForge([file]);
      const release = await seedSnapshot(modpack, id, `test.${id}`, [file]);
      await launcherPackReleaseService.prepareSnapshot(modpack, release.id, {
        version: `test.${id}`,
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      });
      return modpack;
    }

    it("opens the zip of a readied snapshot on the sandbox, named and sized from the release", async () => {
      await readySnapshot(7);
      vi.mocked(openSandboxFile).mockResolvedValue(stream());
      const signal = new AbortController().signal;

      const download = await launcherPackFileService.openStorageSnapshot(
        7,
        signal,
      );

      expect(openSandboxFile).toHaveBeenCalledWith(
        "snapshot/7",
        SNAPSHOT_ZIP.size,
        signal,
      );
      expect(download.fileName).toBe(SNAPSHOT_ZIP.fileName);
      expect(download.size).toBe(SNAPSHOT_ZIP.size);
      expect(await new Response(download.body).text()).toBe("zip bytes");
    });

    it("refuses a snapshot that is recorded but not ready, without asking the sandbox", async () => {
      const modpack = await seedSandboxPack();
      await seedSnapshot(modpack, 7, "test.7", [await seedFile()]);

      await expect(
        launcherPackFileService.openStorageSnapshot(
          7,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
      expect(openSandboxFile).not.toHaveBeenCalled();
    });

    it("refuses a snapshot id no sandbox pack carries", async () => {
      await readySnapshot(7);

      await expect(
        launcherPackFileService.openStorageSnapshot(
          8,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
      expect(openSandboxFile).not.toHaveBeenCalled();
    });

    it("says the zip is not found when the sandbox no longer keeps it", async () => {
      await readySnapshot(7);
      vi.mocked(openSandboxFile).mockResolvedValue(null);

      await expect(
        launcherPackFileService.openStorageSnapshot(
          7,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    });

    it("says the zip cannot be served while the sandbox fails", async () => {
      await readySnapshot(7);
      vi.mocked(openSandboxFile).mockRejectedValue(
        new SandboxUnavailableError("The sandbox answered 500 for snapshot/7"),
      );

      await expect(
        launcherPackFileService.openStorageSnapshot(
          7,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ statusCode: 502, code: "FILE_UNAVAILABLE" });
    });
  });

  it("retires every older snapshot so only the newest is installable", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const snapshot = async (id: number, version: string) => {
      const release = await seedSnapshot(modpack, id, version, [file]);
      await launcherPackReleaseService.prepareSnapshot(modpack, release.id, {
        version,
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: {
          ...SNAPSHOT_ZIP,
          downloadUrl: `${SNAPSHOT_ZIP.downloadUrl}-${id}`,
        },
        entries: entriesOf([file]),
      });
      return release;
    };
    const first = await snapshot(7, "test.7");
    const second = await snapshot(8, "test.8");

    const listed = await launcherPackService.listReleases(
      "vitest-test",
      FIRST_PAGE,
    );

    expect(listed.total).toBe(1);
    expect(listed.releases.map((release) => release.version)).toEqual([
      "test.8",
    ]);
    expect(
      (await Q.modpack.release.get({ id: first.id })).launcherUnavailableAt,
    ).not.toBeNull();
    expect(
      (await Q.modpack.release.get({ id: second.id })).launcherUnavailableAt,
    ).toBeNull();
    expect(
      (await launcherPackService.getLatestPack("vitest-test")).version,
    ).toBe("test.8");
  });

  it("does not ready a snapshot whose loader cannot be read, and tells the owner", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const release = await seedSnapshot(modpack, 9, "test.9", [file]);

    const outcome = await launcherPackReleaseService.prepareSnapshot(
      modpack,
      release.id,
      {
        version: "test.9",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      },
    );

    expect(outcome).toEqual({
      status: "blocked",
      reason: 'its mod loader "neoforge" does not name a loader and a version',
    });
    expect(await isReady(release.id)).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sendMock.mock.calls[0][0])).toContain(
      "report the snapshot again",
    );
    const error = await refusal(
      launcherPackService.getLatestPack("vitest-test"),
    );
    expect(error.code).toBe("PACK_UNAVAILABLE");
  });

  it("does not ready a snapshot with a client file CurseForge does not know", async () => {
    const modpack = await seedSandboxPack();
    const file = await seedFile();
    const release = await seedSnapshot(modpack, 10, "test.10", [file]);

    const outcome = await launcherPackReleaseService.prepareSnapshot(
      modpack,
      release.id,
      {
        version: "test.10",
        minecraftVersion: "1.21.1",
        modLoader: "neoforge-21.1.249",
        zip: SNAPSHOT_ZIP,
        entries: entriesOf([file]),
      },
    );

    expect(outcome).toMatchObject({
      status: "blocked",
      reason: expect.stringContaining("could not be resolved on CurseForge"),
    });
    expect(await isReady(release.id)).toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("LauncherPackReleaseService.checkReleases", () => {
  it("takes a release whose pack zip was archived out of the list, and leaves the latest pack alone", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const old = await seedReadyRelease(modpack, "1.0.0", [file]);
    const newest = await seedReadyRelease(modpack, "1.1.0", [file]);

    archivedOnCurseForge([old.manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);
    const afterOld = await listedVersions();
    archivedOnCurseForge([old.manifest.fileId, newest.manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    expect(afterOld).toEqual(["1.1.0"]);
    expect(await listedVersions()).toEqual([]);
    expect((await launcherPackService.getLatestPack(PACK_SLUG)).version).toBe(
      "1.1.0",
    );
  });

  it("takes a release out of the list when one of its client files was archived", async () => {
    const modpack = await seedPack();
    const kept = await seedFile();
    const replaced = await seedFile();
    const replacement = await seedFile();
    serveFromCurseForge([kept, replaced, replacement]);
    await seedReadyRelease(modpack, "1.0.0", [kept, replaced]);
    await seedReadyRelease(modpack, "1.1.0", [kept, replacement]);

    archivedOnCurseForge([replaced.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    expect(await listedVersions()).toEqual(["1.1.0"]);
  });

  it("asks CurseForge once about the pack zips and client files of every ready release", async () => {
    const modpack = await seedPack();
    const shared = await seedFile();
    const onlyOld = await seedFile();
    const serverOnly = await seedFile({ sides: "server" });
    serveFromCurseForge([shared, onlyOld, serverOnly]);
    const old = await seedReadyRelease(modpack, "1.0.0", [
      shared,
      onlyOld,
      serverOnly,
    ]);
    const newest = await seedReadyRelease(modpack, "1.1.0", [shared]);
    const notReady = await seedRelease(modpack, "1.2.0", [shared]);

    await launcherPackReleaseService.checkReleases(modpack);

    expect(getServedFileIds).toHaveBeenCalledTimes(1);
    const asked = vi.mocked(getServedFileIds).mock.calls[0][0];
    expect([...asked].sort()).toEqual(
      [
        old.manifest.fileId,
        newest.manifest.fileId,
        shared.fileId,
        onlyOld.fileId,
      ].sort(),
    );
    expect(asked).not.toContain(notReady.manifest.fileId);
  });

  it("keeps a release listed when only a file of its server pack was archived", async () => {
    const modpack = await seedPack();
    const client = await seedFile();
    const serverOnly = await seedFile({ sides: "server" });
    serveFromCurseForge([client, serverOnly]);
    await seedReadyRelease(modpack, "1.0.0", [client, serverOnly]);

    archivedOnCurseForge([serverOnly.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("keeps a release listed when an archived server-only file was resolved by a launcher request", async () => {
    const modpack = await seedPack();
    const client = await seedFile();
    const serverOnly = await seedFile({ sides: "server" });
    serveFromCurseForge([client, serverOnly]);
    await seedReadyRelease(modpack, "1.0.0", [client, serverOnly]);
    const resolved = await launcherPackFileService.resolveFiles([
      serverOnly.fileId,
    ]);

    archivedOnCurseForge([serverOnly.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    expect(resolved.files.map((file) => file.fileId)).toEqual([
      serverOnly.fileId,
    ]);
    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("lets only the pack zip decide for a release recorded without sides", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { release, manifest } = await seedReadyRelease(modpack, "1.0.0", [
      file,
    ]);
    await Q.modpack.release.mod.updateAll(
      { inClientPack: null },
      { releaseId: release.id },
    );

    archivedOnCurseForge([file.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);
    const afterFile = await listedVersions();
    archivedOnCurseForge([manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);

    expect(afterFile).toEqual(["1.0.0"]);
    expect(await listedVersions()).toEqual([]);
  });

  it("lists a release again once CurseForge serves its files again", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    const { manifest } = await seedReadyRelease(modpack, "1.0.0", [file]);
    archivedOnCurseForge([manifest.fileId]);
    await launcherPackReleaseService.checkReleases(modpack);
    const whileArchived = await listedVersions();

    archivedOnCurseForge([]);
    await launcherPackReleaseService.checkReleases(modpack);

    expect(whileArchived).toEqual([]);
    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("changes nothing when CurseForge cannot be asked", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(getServedFileIds).mockRejectedValue(new Error("CurseForge 504"));

    await expect(
      launcherPackReleaseService.checkReleases(modpack),
    ).rejects.toThrow(/504/);

    expect(await listedVersions()).toEqual(["1.0.0"]);
  });

  it("stores the pack's project again, so what CurseForge changed reaches the launcher", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    await seedReadyRelease(modpack, "1.0.0", [file]);
    vi.mocked(refreshProjects).mockImplementation(async (projectIds) => {
      return Q.curseforge.project.updateAll(
        {
          name: "Vitest Pack, renamed",
          thumbnailUrl: "https://media.forgecdn.net/avatars/vitest-new.png",
        },
        { id: { $in: projectIds } },
      );
    });

    await launcherPackReleaseService.checkReleases(modpack);

    expect(refreshProjects).toHaveBeenCalledWith([PACK_PROJECT_ID]);
    expect(
      (await launcherPackService.getLatestPack(PACK_SLUG)).project,
    ).toEqual({
      ...packProject(),
      name: "Vitest Pack, renamed",
      iconUrl: "https://media.forgecdn.net/avatars/vitest-new.png",
    });
  });

  it("ignores a modpack the launcher does not install", async () => {
    const modpack = await seedModpack(ctx, {
      curseforgeProjectId: PACK_PROJECT_ID + 1,
    });

    await launcherPackReleaseService.checkReleases(modpack);

    expect(getServedFileIds).not.toHaveBeenCalled();
    expect(refreshProjects).not.toHaveBeenCalled();
  });
});
