import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/services/curseforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/curseforge")>();
  return {
    ...actual,
    getFilesDetails: vi.fn(async () => []),
    getModpackFile: vi.fn(async () => null),
  };
});
vi.mock("@/services/curseforge/ingest", () => ({
  refreshProjects: vi.fn(async () => 0),
}));
vi.mock("@/services/modrinth", () => ({
  findModrinthFilesBySha1: vi.fn(async () => new Map()),
}));
vi.mock("@/services/launcher/pack/sandbox-files", () => ({
  findSandboxFileUrl: vi.fn(async () => null),
}));
vi.mock("@/utils/mojang-java-version", () => ({
  getMinecraftJavaMajorVersion: vi.fn(async () => 21),
}));

import config from "@/config";
import pool, { Q } from "@/db";
import { Discord } from "@/discord/constants";
import {
  getFilesDetails,
  getModpackFile,
  type CurseForgeFileDetail,
  type ModpackFile,
  type ModpackManifest,
  type ModpackManifestSides,
} from "@/services/curseforge";
import { refreshProjects } from "@/services/curseforge/ingest";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { findSandboxFileUrl } from "@/services/launcher/pack/sandbox-files";
import { findModrinthFilesBySha1 } from "@/services/modrinth";
import { getMinecraftJavaMajorVersion } from "@/utils/mojang-java-version";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import {
  cleanupWorkshopTestContext,
  createWorkshopTestContext,
  seedModpack,
  seedProject,
} from "@/tests/helpers/workshop";

const PACK_PROJECT_ID = 995_900_001;
const HOUR_MS = 60 * 60 * 1000;

const ctx = createWorkshopTestContext(995_000_000);
const originalPackProjectId = config.curseforge.modpackProjectId;

let nextFileId = 990_000_000;
let nextPackFileId = 990_500_000;

const sha1Of = (fileId: number) => fileId.toString(16).padStart(40, "0");
const cdnUrl = (fileId: number) =>
  `https://edge.forgecdn.net/files/${fileId}/mod-${fileId}.jar`;
const modrinthUrl = (fileId: number) =>
  `https://cdn.modrinth.com/data/vitest/versions/${fileId}/mod-${fileId}.jar`;

interface SeededFile {
  fileId: number;
  projectId: number;
  sides: ModpackManifestSides;
  required: boolean;
  detail: CurseForgeFileDetail;
}

async function seedFile(
  options: {
    blocked?: boolean;
    classId?: number;
    sides?: ModpackManifestSides;
    required?: boolean;
    detail?: Partial<CurseForgeFileDetail>;
  } = {},
): Promise<SeededFile> {
  const projectId = await seedProject(ctx, undefined, {
    classId: options.classId ?? 6,
    websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${nextFileId}`,
  });
  const fileId = nextFileId++;
  return {
    fileId,
    projectId,
    sides: options.sides ?? "both",
    required: options.required ?? true,
    detail: {
      fileId,
      projectId,
      displayName: `Mod ${fileId}`,
      fileName: `mod-${fileId}.jar`,
      fileDate: null,
      releaseType: 1,
      gameId: 432,
      downloadUrl: options.blocked ? null : cdnUrl(fileId),
      fileLength: 1000 + (fileId % 1000),
      sha1: sha1Of(fileId),
      ...options.detail,
    },
  };
}

function serveFromCurseForge(files: SeededFile[]): void {
  const byId = new Map(files.map((file) => [file.fileId, file.detail]));
  vi.mocked(getFilesDetails).mockImplementation(async (fileIds) =>
    fileIds.flatMap((id) => byId.get(id) ?? []),
  );
}

function serveFromModrinth(files: SeededFile[]): void {
  const hosted = new Map(
    files.map((file) => [sha1Of(file.fileId), modrinthUrl(file.fileId)]),
  );
  vi.mocked(findModrinthFilesBySha1).mockImplementation(async (hashes) => {
    return new Map(
      hashes.flatMap((sha1) => {
        const url = hosted.get(sha1);
        return url
          ? [[sha1, { sha1, url, fileName: "mod.jar", size: 1 }] as const]
          : [];
      }),
    );
  });
}

function packZip(fileId: number, overrides: Partial<ModpackFile> = {}) {
  vi.mocked(getModpackFile).mockResolvedValue({
    id: fileId,
    projectId: PACK_PROJECT_ID,
    displayName: "Vitest Pack 1.0.0",
    fileName: `vitest-pack-${fileId}.zip`,
    fileDate: "2026-10-01T10:00:00.000Z",
    downloadUrl: `https://edge.forgecdn.net/files/${fileId}/vitest-pack.zip`,
    fileLength: 4_500_000,
    sha1: sha1Of(fileId),
    fileStatus: 4,
    isAvailable: true,
    serverPackFileId: null,
    alternateFileId: null,
    parentProjectFileId: null,
    isServerPack: false,
    ...overrides,
  });
}

async function seedRelease(
  modpack: Modpack,
  version: string,
  files: SeededFile[],
  overrides: Partial<ModpackManifest> = {},
): Promise<{ release: ModpackRelease; manifest: ModpackManifest }> {
  const manifest: ModpackManifest = {
    fileId: nextPackFileId++,
    serverPackFileId: null,
    displayName: `Vitest Pack ${version}`,
    version,
    minecraftVersion: "1.21.1",
    modLoader: "neoforge-21.1.249",
    publishedAt: "2026-10-01T10:00:00.000Z",
    entries: files.map((file) => ({
      projectId: file.projectId,
      fileId: file.fileId,
      required: file.required,
      sides: file.sides,
    })),
    modIds: new Set(files.map((file) => file.projectId)),
    disabledModIds: new Set(),
    ...overrides,
  };
  const release = await Q.modpack.release.createAndReturn({
    modpackId: modpack.id,
    curseforgeFileId: manifest.fileId,
    version: manifest.version,
    displayName: manifest.displayName,
    minecraftVersion: manifest.minecraftVersion,
    modLoader: manifest.modLoader,
    modCount: files.length,
    publishedAt: new Date("2026-10-01T10:00:00.000Z"),
  });
  packZip(manifest.fileId);
  return { release, manifest };
}

async function seedPack(): Promise<Modpack> {
  return seedModpack(ctx, {
    name: "Vitest Pack",
    curseforgeProjectId: PACK_PROJECT_ID,
  });
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; statusCode?: number };
  }
  throw new Error("Expected the call to be refused");
}

const isReady = async (releaseId: number) =>
  (await Q.modpack.release.get({ id: releaseId })).launcherReadyAt !== null;

beforeAll(async () => {
  await pool.query("SELECT 1");
});

beforeEach(() => {
  (config.curseforge as { modpackProjectId: number }).modpackProjectId =
    PACK_PROJECT_ID;
  vi.mocked(getFilesDetails).mockResolvedValue([]);
  vi.mocked(getModpackFile).mockResolvedValue(null);
  vi.mocked(refreshProjects).mockResolvedValue(0);
  vi.mocked(findModrinthFilesBySha1).mockResolvedValue(new Map());
  vi.mocked(findSandboxFileUrl).mockResolvedValue(null);
  vi.mocked(getMinecraftJavaMajorVersion).mockResolvedValue(21);
  sendMock.mockResolvedValue({ success: true });
  vi.spyOn(Discord, "Messages", "get").mockReturnValue({
    send: sendMock,
  } as unknown as typeof Discord.Messages);
});

afterEach(async () => {
  if (ctx.projectIds.length > 0) {
    await Q.curseforge.file.deleteAll({
      curseforgeProjectId: { $in: ctx.projectIds },
    });
  }
  await cleanupWorkshopTestContext(ctx);
  vi.resetAllMocks();
});

afterAll(async () => {
  (config.curseforge as { modpackProjectId: number }).modpackProjectId =
    originalPackProjectId;
  await pool.end();
});

describe("LauncherPackService.prepareRelease", () => {
  it("makes a release ready and serves it as the latest pack", async () => {
    const modpack = await seedPack();
    const files = [await seedFile(), await seedFile()];
    serveFromCurseForge(files);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await launcherPackService.getLatestPack()).toEqual({
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
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("stores each client file with its source, folder and CurseForge hash", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const onModrinth = await seedFile({ blocked: true });
    const shader = await seedFile({ classId: 6552, sides: "client" });
    const resourcePack = await seedFile({ classId: 12, sides: "client" });
    const files = [served, onModrinth, shader, resourcePack];
    serveFromCurseForge(files);
    serveFromModrinth([onModrinth, served]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    vi.mocked(getFilesDetails).mockClear();
    const resolved = await launcherPackService.resolveFiles(
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
      },
      expect.objectContaining({
        fileId: onModrinth.fileId,
        sha1: sha1Of(onModrinth.fileId),
        folder: "mods",
        source: "modrinth",
        url: modrinthUrl(onModrinth.fileId),
      }),
      expect.objectContaining({
        fileId: shader.fileId,
        folder: "shaderpacks",
        source: "curseforge",
      }),
      expect.objectContaining({
        fileId: resourcePack.fileId,
        folder: "resourcepacks",
        source: "curseforge",
      }),
    ]);
  });

  it("only asks Modrinth about files CurseForge blocks", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([served, blocked]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      served,
      blocked,
    ]);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findModrinthFilesBySha1).toHaveBeenCalledWith([
      sha1Of(blocked.fileId),
    ]);
  });

  it("tells the owner when a client file has no download source", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    const manual = await seedFile({ blocked: true });
    const disabled = await seedFile({ blocked: true, required: false });
    const files = [served, manual, disabled];
    serveFromCurseForge(files);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

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

    const resolved = await launcherPackService.resolveFiles([manual.fileId]);
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
    const sandboxUrl = `https://sandbox.createrington.test/api/pack/files/${onSandbox.fileId}`;
    vi.mocked(findSandboxFileUrl).mockResolvedValue(sandboxUrl);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", files);

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(findSandboxFileUrl).toHaveBeenCalledTimes(1);
    expect(findSandboxFileUrl).toHaveBeenCalledWith({
      fileId: onSandbox.fileId,
      sha1: sha1Of(onSandbox.fileId),
      size: onSandbox.detail.fileLength,
    });
    expect(sendMock).not.toHaveBeenCalled();
    const resolved = await launcherPackService.resolveFiles([onSandbox.fileId]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: onSandbox.fileId,
        source: "storage",
        url: sandboxUrl,
        sha1: sha1Of(onSandbox.fileId),
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

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

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
    await launcherPackService.prepareRelease(
      modpack,
      first.release.id,
      first.manifest,
    );
    const second = await seedRelease(modpack, "1.1.0", [known, unknown]);

    await launcherPackService.prepareRelease(
      modpack,
      second.release.id,
      second.manifest,
    );
    await launcherPackService.prepareRelease(
      modpack,
      second.release.id,
      second.manifest,
    );

    expect(await isReady(second.release.id)).toBe(false);
    expect((await launcherPackService.getLatestPack()).version).toBe("1.0.0");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].embeds.data.description).toContain(
      String(unknown.fileId),
    );
  });

  it("becomes ready on a later attempt once the missing file resolves", async () => {
    const modpack = await seedPack();
    const late = await seedFile();
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [late]);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);
    expect(await isReady(release.id)).toBe(false);

    serveFromCurseForge([late]);
    packZip(manifest.fileId);
    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await isReady(release.id)).toBe(true);
  });

  it("does not store a blocked file as manual while Modrinth cannot be asked", async () => {
    const modpack = await seedPack();
    const blocked = await seedFile({ blocked: true });
    serveFromCurseForge([blocked]);
    vi.mocked(findModrinthFilesBySha1).mockRejectedValue(
      new Error("Modrinth version_files failed (503)"),
    );
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      blocked,
    ]);

    await expect(
      launcherPackService.prepareRelease(modpack, release.id, manifest),
    ).rejects.toThrow(/503/);

    expect(await isReady(release.id)).toBe(false);
    expect(await Q.curseforge.file.find({ id: blocked.fileId })).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
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

      await launcherPackService.prepareRelease(modpack, release.id, manifest);

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

    await launcherPackService.prepareRelease(modpack, release.id, manifest);

    expect(await isReady(release.id)).toBe(false);
    expect(getFilesDetails).not.toHaveBeenCalled();
  });
});

describe("LauncherPackService.getLatestPack", () => {
  it("answers PACK_UNAVAILABLE while no release is ready", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "1.0.0", [await seedFile()]);

    const error = await refusal(launcherPackService.getLatestPack());

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("PACK_UNAVAILABLE");
  });

  it("serves the newest ready release", async () => {
    const modpack = await seedPack();
    const file = await seedFile();
    serveFromCurseForge([file]);
    for (const version of ["1.0.0", "1.1.0"]) {
      const { release, manifest } = await seedRelease(modpack, version, [file]);
      await launcherPackService.prepareRelease(modpack, release.id, manifest);
    }

    expect((await launcherPackService.getLatestPack()).version).toBe("1.1.0");
  });
});

describe("LauncherPackService.resolveFiles", () => {
  it("resolves and stores a file no release ships, caching its project first", async () => {
    const file = await seedFile();
    await Q.curseforge.project.deleteAll({ id: file.projectId });
    serveFromCurseForge([file]);
    vi.mocked(refreshProjects).mockImplementation(async (projectIds) => {
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

    const first = await launcherPackService.resolveFiles([file.fileId]);
    const second = await launcherPackService.resolveFiles([file.fileId]);

    expect(refreshProjects).toHaveBeenCalledWith([file.projectId]);
    expect(first.files).toEqual([
      expect.objectContaining({ fileId: file.fileId, source: "curseforge" }),
    ]);
    expect(second).toEqual(first);
    expect(getFilesDetails).toHaveBeenCalledTimes(1);
  });

  it("lists the ids it cannot serve as unresolved", async () => {
    const good = await seedFile();
    const unknown = await seedFile();
    const dataPack = await seedFile({ classId: 6945 });
    const noHash = await seedFile({ detail: { sha1: null } });
    const otherGame = await seedFile({ detail: { gameId: 1 } });
    serveFromCurseForge([good, dataPack, noHash, otherGame]);

    const resolved = await launcherPackService.resolveFiles([
      good.fileId,
      unknown.fileId,
      dataPack.fileId,
      noHash.fileId,
      otherGame.fileId,
    ]);

    expect(resolved.files.map((file) => file.fileId)).toEqual([good.fileId]);
    expect(resolved.unresolvedFileIds).toEqual([
      unknown.fileId,
      dataPack.fileId,
      noHash.fileId,
      otherGame.fileId,
    ]);
  });

  it("answers FILE_SOURCES_UNAVAILABLE when a new file cannot be looked up", async () => {
    const file = await seedFile();
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    const error = await refusal(
      launcherPackService.resolveFiles([file.fileId]),
    );

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("FILE_SOURCES_UNAVAILABLE");
  });

  it("looks a manual file up again after an hour and picks up a new source", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    serveFromModrinth([file]);

    const withinTheHour = await launcherPackService.resolveFiles([file.fileId]);
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date(Date.now() - 2 * HOUR_MS) },
      { id: file.fileId },
    );
    const afterTheHour = await launcherPackService.resolveFiles([file.fileId]);

    expect(withinTheHour.files[0].source).toBe("manual");
    expect(afterTheHour.files[0]).toEqual(
      expect.objectContaining({
        source: "modrinth",
        url: modrinthUrl(file.fileId),
      }),
    );
  });

  it("keeps serving a manual file as manual when the second lookup fails", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackService.resolveFiles([file.fileId]);
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date(Date.now() - 2 * HOUR_MS) },
      { id: file.fileId },
    );
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    const resolved = await launcherPackService.resolveFiles([file.fileId]);

    expect(resolved.files[0].source).toBe("manual");
  });
});
