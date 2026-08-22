import { describe, it, expect } from "vitest";
import { manifestDisabledModIds } from "@/services/curseforge";

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
