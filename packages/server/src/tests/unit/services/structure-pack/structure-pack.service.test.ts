import { describe, it, expect, vi, beforeEach } from "vitest";

const { findWithMods, getFilesDependencies, resolveDependencies } = vi.hoisted(
  () => ({
    findWithMods: vi.fn(),
    getFilesDependencies: vi.fn(),
    resolveDependencies: vi.fn(),
  }),
);

vi.mock("@/db", () => ({
  Q: { structure: { pack: { findWithMods } } },
  db: {},
}));
vi.mock("@/services/curseforge/files", () => ({ getFilesDependencies }));
vi.mock("@/services/curseforge/mods", () => ({ resolveDependencies }));

import { structurePackService } from "@/services/structure-pack/structure-pack.service";

const REQUIRED = 3;
const OPTIONAL = 2;

const mod = (id: number, curseforgeModId: number, modName: string) => ({
  id,
  curseforgeModId,
  curseforgeFileId: curseforgeModId * 10,
  modName,
});

const TARGET = mod(1, 100, "Target");
const NEEDS_TARGET = mod(2, 200, "Needs Target");
const SHARED_LIB = mod(3, 300, "Shared Lib");
const OWN_LIB = mod(4, 400, "Own Lib");

const file = (
  m: { curseforgeModId: number; curseforgeFileId: number },
  dependencies: Array<{ modId: number; relationType: number }>,
) => ({
  fileId: m.curseforgeFileId,
  modId: m.curseforgeModId,
  dependencies,
});

beforeEach(() => {
  vi.clearAllMocks();
  findWithMods.mockResolvedValue({
    id: 7,
    mods: [TARGET, NEEDS_TARGET, SHARED_LIB, OWN_LIB],
  });
  getFilesDependencies.mockResolvedValue([
    file(TARGET, [
      { modId: SHARED_LIB.curseforgeModId, relationType: REQUIRED },
      { modId: OWN_LIB.curseforgeModId, relationType: REQUIRED },
      { modId: 999, relationType: REQUIRED },
    ]),
    file(NEEDS_TARGET, [
      { modId: TARGET.curseforgeModId, relationType: OPTIONAL },
      { modId: SHARED_LIB.curseforgeModId, relationType: REQUIRED },
    ]),
    file(SHARED_LIB, []),
    file(OWN_LIB, []),
  ]);
  resolveDependencies.mockImplementation(async (modIds: number[]) =>
    modIds.map((modId) => ({ modId, modName: `resolved ${modId}` })),
  );
});

describe("structurePackService.checkDeleteDependencies", () => {
  it("lists the pack mods that depend on the removed mod", async () => {
    const { dependents } = await structurePackService.checkDeleteDependencies(
      7,
      TARGET.id,
    );

    expect(dependents).toEqual([
      { modName: "Needs Target", relationType: OPTIONAL },
    ]);
  });

  it("marks an in-pack dependency safe only when no other mod needs it", async () => {
    const { deps } = await structurePackService.checkDeleteDependencies(
      7,
      TARGET.id,
    );

    expect(resolveDependencies).toHaveBeenCalledWith(
      [SHARED_LIB.curseforgeModId, OWN_LIB.curseforgeModId],
      new Set([100, 200, 300, 400]),
    );
    expect(deps).toEqual([
      {
        modId: SHARED_LIB.curseforgeModId,
        modName: "resolved 300",
        safe: false,
        neededBy: ["Needs Target"],
      },
      {
        modId: OWN_LIB.curseforgeModId,
        modName: "resolved 400",
        safe: true,
        neededBy: [],
      },
    ]);
  });

  it("returns nothing for a mod that is not in the pack", async () => {
    const result = await structurePackService.checkDeleteDependencies(7, 42);

    expect(result).toEqual({ deps: [], dependents: [] });
    expect(getFilesDependencies).not.toHaveBeenCalled();
  });

  it("skips resolving when the mod has no dependencies inside the pack", async () => {
    const result = await structurePackService.checkDeleteDependencies(
      7,
      OWN_LIB.id,
    );

    expect(result).toEqual({
      deps: [],
      dependents: [{ modName: "Target", relationType: REQUIRED }],
    });
    expect(resolveDependencies).not.toHaveBeenCalled();
  });
});
