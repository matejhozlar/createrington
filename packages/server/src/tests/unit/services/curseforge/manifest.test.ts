import { describe, it, expect, vi } from "vitest";
import {
  manifestDisabledModIds,
  mergeManifestFiles,
  resolveModpackRelease,
  type ModpackFile,
  type ModpackReadContext,
} from "@/services/curseforge";

function file(overrides: Partial<ModpackFile> & { id: number }): ModpackFile {
  return {
    projectId: 1,
    displayName: null,
    fileDate: null,
    fileStatus: null,
    isAvailable: true,
    serverPackFileId: null,
    alternateFileId: null,
    parentProjectFileId: null,
    isServerPack: false,
    ...overrides,
  };
}

function context(
  overrides: Partial<ModpackReadContext> = {},
): ModpackReadContext {
  return { shipsServerPack: false, publishes: [], ...overrides };
}

function reader(files: ModpackFile[]) {
  return vi.fn(
    async (fileId: number) => files.find((f) => f.id === fileId) ?? null,
  );
}

describe("resolveModpackRelease", () => {
  it("takes the listing's newest file and CurseForge's own server pack link", async () => {
    const read = reader([]);
    const resolved = await resolveModpackRelease(
      file({ id: 100, serverPackFileId: 101 }),
      context(),
      read,
    );
    expect(resolved).toMatchObject({
      file: { id: 100 },
      serverPackFileId: 101,
      complete: true,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("reads a reported client file newer than the listing directly, with its reported server pack", async () => {
    const read = reader([file({ id: 200 })]);
    const resolved = await resolveModpackRelease(
      file({ id: 100, serverPackFileId: 101 }),
      context({
        shipsServerPack: true,
        publishes: [{ clientFileId: 200, serverPackFileId: 201 }],
      }),
      read,
    );
    expect(resolved).toMatchObject({
      file: { id: 200 },
      serverPackFileId: 201,
      complete: true,
    });
    expect(read).toHaveBeenCalledWith(200);
  });

  it("stays on the listing while CurseForge does not serve the reported file yet", async () => {
    const read = reader([file({ id: 200, isAvailable: false })]);
    const resolved = await resolveModpackRelease(
      file({ id: 100 }),
      context({
        shipsServerPack: true,
        publishes: [{ clientFileId: 200, serverPackFileId: 201 }],
      }),
      read,
    );
    expect(resolved).toMatchObject({
      file: { id: 100 },
      serverPackFileId: null,
      complete: false,
    });
  });

  it("ignores a report older than the listing's newest file", async () => {
    const read = reader([file({ id: 200 })]);
    const resolved = await resolveModpackRelease(
      file({ id: 300, serverPackFileId: 301 }),
      context({ publishes: [{ clientFileId: 200, serverPackFileId: 201 }] }),
      read,
    );
    expect(resolved).toMatchObject({
      file: { id: 300 },
      serverPackFileId: 301,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("uses the report for the listed file when CurseForge has not linked the server pack", async () => {
    const resolved = await resolveModpackRelease(
      file({ id: 100 }),
      context({ publishes: [{ clientFileId: 100, serverPackFileId: 102 }] }),
      reader([]),
    );
    expect(resolved).toMatchObject({ serverPackFileId: 102, complete: true });
  });

  it("lets CurseForge's own link win over a disagreeing report", async () => {
    const resolved = await resolveModpackRelease(
      file({ id: 100, serverPackFileId: 101 }),
      context({ publishes: [{ clientFileId: 100, serverPackFileId: 102 }] }),
      reader([]),
    );
    expect(resolved.serverPackFileId).toBe(101);
  });

  it("accepts the alternate file as the server pack when it is one for this release", async () => {
    const resolved = await resolveModpackRelease(
      file({ id: 100, alternateFileId: 105 }),
      context({ shipsServerPack: true }),
      reader([file({ id: 105, isServerPack: true, parentProjectFileId: 100 })]),
    );
    expect(resolved).toMatchObject({ serverPackFileId: 105, complete: true });
  });

  it("rejects an alternate file that is a plain alternate or belongs to another release", async () => {
    const plain = await resolveModpackRelease(
      file({ id: 100, alternateFileId: 105 }),
      context({ shipsServerPack: true }),
      reader([
        file({ id: 105, isServerPack: false, parentProjectFileId: 100 }),
      ]),
    );
    expect(plain).toMatchObject({ serverPackFileId: null, complete: false });

    const foreign = await resolveModpackRelease(
      file({ id: 100, alternateFileId: 105 }),
      context({ shipsServerPack: true }),
      reader([file({ id: 105, isServerPack: true, parentProjectFileId: 99 })]),
    );
    expect(foreign.serverPackFileId).toBeNull();
  });

  it("treats a read without a server pack as complete when the pack ships none", async () => {
    const clientOnly = await resolveModpackRelease(
      file({ id: 100 }),
      context({ shipsServerPack: false }),
      reader([]),
    );
    expect(clientOnly.complete).toBe(true);
  });

  it("throws when neither the listing nor a report yields a file", async () => {
    await expect(
      resolveModpackRelease(null, context(), reader([])),
    ).rejects.toThrow("No modpack files found");
    await expect(
      resolveModpackRelease(
        null,
        context({ publishes: [{ clientFileId: 200, serverPackFileId: 201 }] }),
        reader([]),
      ),
    ).rejects.toThrow("No modpack files found");
  });
});

describe("mergeManifestFiles", () => {
  it("unions both manifests, client entries first, and records the sides", () => {
    const merged = mergeManifestFiles(
      [
        { projectId: 1, fileId: 10 },
        { projectId: 2, fileId: 20 },
      ],
      [
        { projectId: 3, fileId: 30 },
        { projectId: 2, fileId: 20 },
      ],
    );
    expect(merged).toEqual([
      { projectId: 1, fileId: 10, sides: "client" },
      { projectId: 2, fileId: 20, sides: "both" },
      { projectId: 3, fileId: 30, sides: "server" },
    ]);
  });

  it("lists a project once even when both manifests carry it", () => {
    const merged = mergeManifestFiles(
      [{ projectId: 1, fileId: 10 }],
      [{ projectId: 1, fileId: 11 }],
    );
    expect(merged).toEqual([{ projectId: 1, fileId: 10, sides: "both" }]);
  });

  it("lets the client entry's required flag win when the manifests disagree", () => {
    const merged = mergeManifestFiles(
      [{ projectId: 1, fileId: 10, required: false }],
      [{ projectId: 1, fileId: 10, required: true }],
    );
    expect(merged).toEqual([
      { projectId: 1, fileId: 10, required: false, sides: "both" },
    ]);
    expect([...manifestDisabledModIds(merged)]).toEqual([1]);
  });

  it("keeps a manifest's own repeated entries", () => {
    const merged = mergeManifestFiles(
      [
        { projectId: 1, fileId: 10 },
        { projectId: 1, fileId: 11 },
      ],
      [],
    );
    expect(merged.map((file) => file.fileId)).toEqual([10, 11]);
    expect(merged.every((file) => file.sides === "client")).toBe(true);
  });

  it("marks every entry client-side when there is no server pack", () => {
    const merged = mergeManifestFiles([{ projectId: 1, fileId: 10 }], null);
    expect(merged).toEqual([{ projectId: 1, fileId: 10, sides: "client" }]);
  });
});

describe("manifestDisabledModIds", () => {
  it("collects projects whose entries are all not required", () => {
    const disabled = manifestDisabledModIds([
      { projectId: 1, required: true },
      { projectId: 2, required: false },
      { projectId: 3, required: false },
    ]);
    expect([...disabled].sort()).toEqual([2, 3]);
  });

  it("keeps a project enabled when any of its entries is required", () => {
    const disabled = manifestDisabledModIds([
      { projectId: 1, required: false },
      { projectId: 1, required: true },
      { projectId: 2, required: false },
    ]);
    expect([...disabled]).toEqual([2]);
  });

  it("is empty for an all-required manifest", () => {
    expect(
      manifestDisabledModIds([{ projectId: 1, required: true }]).size,
    ).toBe(0);
  });
});
