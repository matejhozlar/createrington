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
import { getFilesDetails } from "@/services/curseforge/files";
import { resolveFileDownloads } from "@/services/curseforge/downloads";
import { ingestProjectsWhere } from "@/services/curseforge/ingest";
import { launcherPackFileService } from "@/services/launcher/pack/pack-files.service";
import { launcherPackReleaseService } from "@/services/launcher/pack/pack-release.service";
import {
  findSandboxFileUrls,
  openSandboxFile,
  SandboxUnavailableError,
} from "@/services/launcher/pack/sandbox-files";
import {
  HOUR_MS,
  modrinthUrl,
  builtCdnUrl,
  storageUrl,
  type SeededFile,
  seedFile,
  serveFromCurseForge,
  serveFromModrinth,
  serveFromBuiltCdnAddress,
  serveFromSandbox,
  useBuiltCdnAddress,
  ageStoredFile,
  ingestFromCurseForge,
  seedRelease,
  seedReadyRelease,
  seedPack,
  refusal,
  useLauncherPackTestHooks,
} from "@/tests/helpers/launcher-pack-harness";

useLauncherPackTestHooks();

describe("LauncherPackFileService.resolveFiles", () => {
  it("resolves and stores a file no release ships, caching its project first", async () => {
    const file = await seedFile();
    await Q.curseforge.project.deleteAll({ id: file.projectId });
    serveFromCurseForge([file]);
    ingestFromCurseForge(new Map([[file.projectId, 6]]));

    const first = await launcherPackFileService.resolveFiles([file.fileId]);
    const second = await launcherPackFileService.resolveFiles([file.fileId]);

    expect(ingestProjectsWhere).toHaveBeenCalledWith(
      [file.projectId],
      expect.any(Function),
    );
    expect(first.files).toEqual([
      expect.objectContaining({ fileId: file.fileId, source: "curseforge" }),
    ]);
    expect(second).toEqual(first);
    expect(getFilesDetails).toHaveBeenCalledTimes(1);
  });

  it("does not cache the project of a file the launcher cannot install", async () => {
    const dataPack = await seedFile({ classId: 6945 });
    await Q.curseforge.project.deleteAll({ id: dataPack.projectId });
    serveFromCurseForge([dataPack]);
    ingestFromCurseForge(new Map([[dataPack.projectId, 6945]]));

    const resolved = await launcherPackFileService.resolveFiles([
      dataPack.fileId,
    ]);

    expect(resolved.unresolvedFileIds).toEqual([dataPack.fileId]);
    expect(
      await Q.curseforge.project.find({ id: dataPack.projectId }),
    ).toBeNull();
  });

  it("lists the ids it cannot serve as unresolved", async () => {
    const good = await seedFile();
    const unknown = await seedFile();
    const dataPack = await seedFile({ classId: 6945 });
    const noHash = await seedFile({ detail: { sha1: null } });
    const otherGame = await seedFile({ detail: { gameId: 1 } });
    serveFromCurseForge([good, dataPack, noHash, otherGame]);

    const resolved = await launcherPackFileService.resolveFiles([
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
      launcherPackFileService.resolveFiles([file.fileId]),
    );

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("FILE_SOURCES_UNAVAILABLE");
  });

  it("answers a stored file as stored and asks no source about it, however old it is", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    serveFromModrinth([file]);
    serveFromSandbox([file]);
    await ageStoredFile(file.fileId, 2 * HOUR_MS);
    vi.mocked(getFilesDetails).mockClear();
    vi.mocked(resolveFileDownloads).mockClear();
    vi.mocked(findSandboxFileUrls).mockClear();

    const resolved = await launcherPackFileService.resolveFiles([file.fileId]);

    expect(resolved.files[0]).toEqual(
      expect.objectContaining({ source: "manual", url: null }),
    );
    expect(getFilesDetails).not.toHaveBeenCalled();
    expect(resolveFileDownloads).not.toHaveBeenCalled();
    expect(findSandboxFileUrls).not.toHaveBeenCalled();
  });

  it("stops handing out the built address once the source is switched off, even while CurseForge cannot be asked", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    await useBuiltCdnAddress(false);
    const resolved = await launcherPackFileService.resolveFiles([file.fileId]);

    expect(resolved.files[0]).toEqual(
      expect.objectContaining({ source: "manual", url: null }),
    );
  });

  it("builds no address for a new file while the flag cannot be read, and leaves a stored one alone", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    const late = await seedFile({ blocked: true });
    serveFromCurseForge([file, late]);
    serveFromBuiltCdnAddress([file, late]);
    await launcherPackFileService.resolveFiles([file.fileId]);

    await useBuiltCdnAddress(true);
    vi.spyOn(Q.feature.flag, "find").mockRejectedValueOnce(
      new Error("Connection terminated unexpectedly"),
    );
    const resolved = await launcherPackFileService.resolveFiles([
      file.fileId,
      late.fileId,
    ]);

    expect(
      vi
        .mocked(resolveFileDownloads)
        .mock.calls.map(([fileIds, options]) => [fileIds, options.cdn]),
    ).toEqual([
      [[file.fileId], true],
      [[late.fileId], false],
    ]);
    expect(resolved.files).toEqual([
      expect.objectContaining({
        fileId: file.fileId,
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
      expect.objectContaining({
        fileId: late.fileId,
        source: "manual",
        url: null,
      }),
    ]);
  });
});

describe("LauncherPackFileService.recheckStaleFiles", () => {
  const storedSource = async (fileId: number) =>
    (await launcherPackFileService.resolveFiles([fileId])).files[0];

  it("looks a manual file up again after an hour and picks up a new source", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    serveFromModrinth([file]);

    await launcherPackFileService.recheckStaleFiles();
    const withinTheHour = await storedSource(file.fileId);
    await ageStoredFile(file.fileId, 2 * HOUR_MS);
    const rechecked = await launcherPackFileService.recheckStaleFiles();
    const afterTheHour = await storedSource(file.fileId);

    expect(withinTheHour.source).toBe("manual");
    expect(rechecked).toBeGreaterThanOrEqual(1);
    expect(afterTheHour).toEqual(
      expect.objectContaining({
        source: "modrinth",
        url: modrinthUrl(file.fileId),
      }),
    );
  });

  it("looks every due file up in one run", async () => {
    const first = await seedFile({ blocked: true });
    const second = await seedFile({ blocked: true });
    serveFromCurseForge([first, second]);
    await launcherPackFileService.resolveFiles([first.fileId, second.fileId]);
    serveFromModrinth([first, second]);
    await ageStoredFile(first.fileId, 3 * HOUR_MS);
    await ageStoredFile(second.fileId, 2 * HOUR_MS);
    vi.mocked(getFilesDetails).mockClear();

    await launcherPackFileService.recheckStaleFiles();

    expect(getFilesDetails).toHaveBeenCalledTimes(1);
    expect(getFilesDetails).toHaveBeenCalledWith(
      expect.arrayContaining([first.fileId, second.fileId]),
    );
    expect((await storedSource(first.fileId)).source).toBe("modrinth");
    expect((await storedSource(second.fileId)).source).toBe("modrinth");
  });

  it("checks a built address again after a day and falls through when it stopped answering", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    serveFromBuiltCdnAddress([]);

    await ageStoredFile(file.fileId, 23 * HOUR_MS);
    await launcherPackFileService.recheckStaleFiles();
    const withinTheDay = await storedSource(file.fileId);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);
    await launcherPackFileService.recheckStaleFiles();
    const afterTheDay = await storedSource(file.fileId);

    expect(withinTheDay).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
    expect(afterTheDay).toEqual(
      expect.objectContaining({ source: "manual", url: null }),
    );
  });

  it("keeps a built address that still answers at the daily check", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);

    await launcherPackFileService.recheckStaleFiles();

    expect(resolveFileDownloads).toHaveBeenCalledTimes(2);
    expect(await storedSource(file.fileId)).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("resolves a file stored with the built address again as soon as the source is switched off", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    const whileOn = await storedSource(file.fileId);
    serveFromSandbox([file]);

    await useBuiltCdnAddress(false);
    await launcherPackFileService.recheckStaleFiles();
    const whileOff = await storedSource(file.fileId);

    expect(whileOn.source).toBe("curseforge-cdn");
    expect(
      vi.mocked(resolveFileDownloads).mock.calls.map(([, options]) => options),
    ).toEqual([{ cdn: true }, { cdn: false }]);
    expect(whileOff).toEqual(
      expect.objectContaining({
        source: "storage",
        url: storageUrl(file.fileId),
      }),
    );
    expect((await Q.curseforge.file.find({ id: file.fileId }))?.source).toBe(
      "storage",
    );
  });

  it("leaves a stored built address alone while the flag cannot be read", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);

    await useBuiltCdnAddress(true);
    vi.spyOn(Q.feature.flag, "find").mockRejectedValueOnce(
      new Error("Connection terminated unexpectedly"),
    );
    await launcherPackFileService.recheckStaleFiles();

    expect(resolveFileDownloads).toHaveBeenCalledTimes(1);
    expect(await storedSource(file.fileId)).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("keeps serving the built address when the daily check cannot ask CurseForge", async () => {
    await useBuiltCdnAddress(true);
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    serveFromBuiltCdnAddress([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 25 * HOUR_MS);
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    await expect(launcherPackFileService.recheckStaleFiles()).rejects.toThrow(
      "CurseForge 504",
    );

    expect(await storedSource(file.fileId)).toEqual(
      expect.objectContaining({
        source: "curseforge-cdn",
        url: builtCdnUrl(file.fileId),
      }),
    );
  });

  it("keeps serving a manual file as manual when the second lookup fails, and does not retry it before it is due again", async () => {
    const file = await seedFile({ blocked: true });
    serveFromCurseForge([file]);
    await launcherPackFileService.resolveFiles([file.fileId]);
    await ageStoredFile(file.fileId, 2 * HOUR_MS);
    vi.mocked(getFilesDetails).mockClear();
    vi.mocked(getFilesDetails).mockRejectedValue(new Error("CurseForge 504"));

    await expect(launcherPackFileService.recheckStaleFiles()).rejects.toThrow();
    await launcherPackFileService.recheckStaleFiles();

    expect(getFilesDetails).toHaveBeenCalledTimes(1);
    expect((await storedSource(file.fileId)).source).toBe("manual");
  });

  it("works through every due file in one run, fifty at a time", async () => {
    const files: SeededFile[] = [];
    for (let i = 0; i < 51; i++) files.push(await seedFile({ blocked: true }));
    const fileIds = files.map((file) => file.fileId);
    serveFromCurseForge(files);
    await launcherPackFileService.resolveFiles(fileIds);
    serveFromModrinth(files);
    await Q.curseforge.file.updateAll(
      { resolvedAt: new Date(Date.now() - 2 * HOUR_MS) },
      { id: { $in: fileIds } },
    );
    vi.mocked(getFilesDetails).mockClear();

    const rechecked = await launcherPackFileService.recheckStaleFiles();

    expect(rechecked).toBeGreaterThanOrEqual(51);
    expect(getFilesDetails).toHaveBeenCalledTimes(2);
    const asked = vi.mocked(getFilesDetails).mock.calls.flatMap(([ids]) => ids);
    expect(asked).toEqual(expect.arrayContaining(fileIds));
    expect(vi.mocked(getFilesDetails).mock.calls[0][0]).toHaveLength(50);
    const resolved = await launcherPackFileService.resolveFiles(fileIds);
    expect(resolved.files.every((file) => file.source === "modrinth")).toBe(
      true,
    );
  });

  it("puts the files of an offered release ahead of older rows no release ships", async () => {
    const modpack = await seedPack();
    const shipped = await seedFile({ blocked: true });
    const adHoc = await seedFile({ blocked: true });
    serveFromCurseForge([shipped, adHoc]);
    await launcherPackFileService.resolveFiles([adHoc.fileId]);
    await seedReadyRelease(modpack, "1.0.0", [shipped]);
    await ageStoredFile(adHoc.fileId, 3 * HOUR_MS);
    await ageStoredFile(shipped.fileId, 2 * HOUR_MS);

    const due = await Q.curseforge.file.getDueIds(
      { manualBefore: new Date(Date.now() - HOUR_MS), cdnBefore: null },
      100,
    );

    expect(due).toEqual(expect.arrayContaining([shipped.fileId, adHoc.fileId]));
    expect(due.indexOf(shipped.fileId)).toBeLessThan(due.indexOf(adHoc.fileId));
  });
});

describe("LauncherPackFileService.openStorageFile", () => {
  async function storeFromSandbox(): Promise<SeededFile> {
    const modpack = await seedPack();
    const onSandbox = await seedFile({ blocked: true });
    serveFromCurseForge([onSandbox]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      onSandbox,
    ]);
    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    return onSandbox;
  }

  it("opens the sandbox copy of a stored file, named and sized from the stored row", async () => {
    const file = await storeFromSandbox();
    vi.mocked(openSandboxFile).mockResolvedValue({
      body: new Blob([Buffer.from("jar bytes")]).stream(),
      size: file.detail.fileLength ?? 0,
    });
    const signal = new AbortController().signal;

    const download = await launcherPackFileService.openStorageFile(
      file.fileId,
      signal,
    );

    expect(openSandboxFile).toHaveBeenCalledWith(
      String(file.fileId),
      file.detail.fileLength,
      signal,
    );
    expect(download.fileName).toBe(file.detail.fileName);
    expect(download.size).toBe(file.detail.fileLength);
    expect(await new Response(download.body).text()).toBe("jar bytes");
  });

  it("refuses a file CurseForge serves itself, without asking the sandbox", async () => {
    const modpack = await seedPack();
    const served = await seedFile();
    serveFromCurseForge([served]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [served]);
    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );

    await expect(
      launcherPackFileService.openStorageFile(
        served.fileId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    expect(openSandboxFile).not.toHaveBeenCalled();
  });

  it("refuses a file id nothing is stored under", async () => {
    await expect(
      launcherPackFileService.openStorageFile(
        999_999_999,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    expect(openSandboxFile).not.toHaveBeenCalled();
  });

  it("says the file is not found when the sandbox no longer keeps it", async () => {
    const file = await storeFromSandbox();
    vi.mocked(openSandboxFile).mockResolvedValue(null);

    await expect(
      launcherPackFileService.openStorageFile(
        file.fileId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
  });

  it("says the file cannot be served while the sandbox fails", async () => {
    const file = await storeFromSandbox();
    vi.mocked(openSandboxFile).mockRejectedValue(
      new SandboxUnavailableError("The sandbox could not be reached"),
    );

    await expect(
      launcherPackFileService.openStorageFile(
        file.fileId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 502, code: "FILE_UNAVAILABLE" });
  });
});

describe("LauncherPackFileService.openStorageFile after the launcher went away", () => {
  it("passes the failure on as it is instead of blaming the sandbox", async () => {
    const modpack = await seedPack();
    const onSandbox = await seedFile({ blocked: true });
    serveFromCurseForge([onSandbox]);
    serveFromSandbox([onSandbox]);
    const { release, manifest } = await seedRelease(modpack, "1.0.0", [
      onSandbox,
    ]);
    await launcherPackReleaseService.prepareRelease(
      modpack,
      release.id,
      manifest,
    );
    const gone = new AbortController();
    const failure = new SandboxUnavailableError(
      "The sandbox could not be reached: This operation was aborted",
    );
    vi.mocked(openSandboxFile).mockImplementation(async () => {
      gone.abort();
      throw failure;
    });

    await expect(
      launcherPackFileService.openStorageFile(onSandbox.fileId, gone.signal),
    ).rejects.toBe(failure);
  });
});
