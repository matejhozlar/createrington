import { describe, it, expect } from "vitest";
import {
  manifestDisabledModIds,
  mergeManifestFiles,
} from "@/services/curseforge";

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
