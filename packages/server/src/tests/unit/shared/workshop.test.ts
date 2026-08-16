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

  it("rejects a manifest listing the same project twice", () => {
    const parsed = modpackManifestUploadSchema.safeParse(
      manifestWith([1001, 1002, 1001, 1003, 1002]),
    );
    expect(parsed.success).toBe(false);
    const custom = parsed.success
      ? undefined
      : parsed.error.issues.find((issue) => issue.code === "custom");
    expect(custom?.message).toContain("1001");
    expect(custom?.message).toContain("1002");
    expect(custom?.message).not.toContain("1003");
  });
});
