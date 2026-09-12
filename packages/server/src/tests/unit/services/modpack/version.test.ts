import { describe, it, expect } from "vitest";
import { isOlderVersion } from "@/services/modpack/version";

describe("isOlderVersion", () => {
  it("orders dot-separated versions by segment", () => {
    expect(isOlderVersion("1.0.6", "1.0.8")).toBe(true);
    expect(isOlderVersion("1.0.9", "1.1.0")).toBe(true);
    expect(isOlderVersion("1.9.0", "2.0.0")).toBe(true);
    expect(isOlderVersion("1.0.10", "1.0.9")).toBe(false);
    expect(isOlderVersion("2.0.0", "1.9.9")).toBe(false);
  });

  it("treats an equal version as not older", () => {
    expect(isOlderVersion("1.0.6", "1.0.6")).toBe(false);
  });

  it("pads missing segments with zero", () => {
    expect(isOlderVersion("1.0", "1.0.1")).toBe(true);
    expect(isOlderVersion("1.0.0", "1.0")).toBe(false);
    expect(isOlderVersion("1", "1.0.0")).toBe(false);
  });

  it("reads a version it cannot compare as not older", () => {
    for (const version of ["1.0.6-dev", "dev", "", "v1.0.6", "1.0.6b"]) {
      expect(isOlderVersion(version, "1.0.8")).toBe(false);
      expect(isOlderVersion("1.0.6", version)).toBe(false);
    }
  });
});
