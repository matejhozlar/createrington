import { describe, it, expect } from "vitest";
import { modpackManifestUploadSchema } from "@createrington/shared/workshop";

function manifestWith(projectIds: number[]) {
  return {
    version: "1.0.0",
    files: projectIds.map((projectID) => ({ projectID })),
  };
}

describe("modpackManifestUploadSchema", () => {
  it("accepts a manifest with unique project ids", () => {
    const parsed = modpackManifestUploadSchema.safeParse(
      manifestWith([1001, 1002, 1003]),
    );
    expect(parsed.success).toBe(true);
  });

  // Real CurseForge exports repeat a project that ships more than one file;
  // the seed path merges them rather than failing the whole import
  it("accepts a manifest listing the same project twice", () => {
    const parsed = modpackManifestUploadSchema.safeParse(
      manifestWith([1001, 1002, 1001]),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects a manifest with no files", () => {
    const parsed = modpackManifestUploadSchema.safeParse(manifestWith([]));
    expect(parsed.success).toBe(false);
  });

  it("keeps the required flag and defaults it to true", () => {
    const parsed = modpackManifestUploadSchema.parse({
      version: "1.0.0",
      files: [{ projectID: 1001, required: false }, { projectID: 1002 }],
    });
    expect(parsed.files).toEqual([
      { projectID: 1001, required: false },
      { projectID: 1002, required: true },
    ]);
  });
});
