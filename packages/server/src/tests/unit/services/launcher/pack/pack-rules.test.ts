import { describe, it, expect } from "vitest";
import {
  curseforgeFilePageUrl,
  packFolderForClass,
  parseModLoader,
  pickFileSource,
} from "@/services/launcher/pack/pack-rules";

describe("packFolderForClass", () => {
  it.each([
    [6, "mods"],
    [12, "resourcepacks"],
    [6552, "shaderpacks"],
  ])("puts class %i into %s", (classId, folder) => {
    expect(packFolderForClass(classId)).toBe(folder);
  });

  it.each([4471, 6945, 17, 0])("has no folder for class %i", (classId) => {
    expect(packFolderForClass(classId)).toBeNull();
  });
});

describe("pickFileSource", () => {
  const CF = "https://edge.forgecdn.net/files/1/2/mod.jar";
  const MR = "https://cdn.modrinth.com/data/abc/versions/def/mod.jar";
  const SANDBOX = "https://sandbox.createrington.test/api/pack/files/7";

  it("prefers CurseForge whenever it serves the file", () => {
    expect(pickFileSource(CF, MR, SANDBOX)).toEqual({
      source: "curseforge",
      downloadUrl: CF,
    });
  });

  it("falls back to Modrinth for a file CurseForge blocks", () => {
    expect(pickFileSource(null, MR, SANDBOX)).toEqual({
      source: "modrinth",
      downloadUrl: MR,
    });
  });

  it("falls back to the sandbox copy when Modrinth has none", () => {
    expect(pickFileSource(null, null, SANDBOX)).toEqual({
      source: "storage",
      downloadUrl: SANDBOX,
    });
  });

  it("is manual without a URL when no source serves the file", () => {
    expect(pickFileSource(null, null, null)).toEqual({
      source: "manual",
      downloadUrl: null,
    });
  });
});

describe("parseModLoader", () => {
  it("splits the loader id into name and exact version", () => {
    expect(parseModLoader("neoforge-21.1.249")).toEqual({
      id: "neoforge-21.1.249",
      name: "neoforge",
      version: "21.1.249",
    });
  });

  it("keeps dashes inside the version", () => {
    expect(parseModLoader("forge-47.2.0-beta")?.version).toBe("47.2.0-beta");
  });

  it.each(["neoforge", "-21.1.249", "neoforge-", ""])(
    "rejects %j",
    (loaderId) => {
      expect(parseModLoader(loaderId)).toBeNull();
    },
  );
});

describe("curseforgeFilePageUrl", () => {
  it("links the file page of the project", () => {
    expect(
      curseforgeFilePageUrl(
        "https://www.curseforge.com/minecraft/mc-mods/create-aeronautics/",
        7001234,
      ),
    ).toBe(
      "https://www.curseforge.com/minecraft/mc-mods/create-aeronautics/files/7001234",
    );
  });

  it("is null for a project without a page", () => {
    expect(curseforgeFilePageUrl(null, 7001234)).toBeNull();
  });
});
