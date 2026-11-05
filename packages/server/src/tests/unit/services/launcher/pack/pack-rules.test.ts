import { describe, it, expect } from "vitest";
import {
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
  const CDN = "https://mediafilez.forgecdn.net/files/1/2/mod.jar";
  const SANDBOX = "https://sandbox.createrington.test/api/pack/files/7";

  it("prefers CurseForge whenever it serves the file", () => {
    expect(
      pickFileSource({
        curseforge: CF,
        resolved: { source: "modrinth", url: MR },
        storage: SANDBOX,
      }),
    ).toEqual({ source: "curseforge", downloadUrl: CF });
  });

  it.each([
    ["Modrinth", "modrinth", MR],
    ["the built CDN address", "curseforge-cdn", CDN],
  ] as const)(
    "falls back to what the gateway resolved: %s",
    (_label, source, url) => {
      expect(
        pickFileSource({
          curseforge: null,
          resolved: { source, url },
          storage: SANDBOX,
        }),
      ).toEqual({ source, downloadUrl: url });
    },
  );

  it("falls back to the sandbox copy when the gateway resolved nothing", () => {
    expect(
      pickFileSource({
        curseforge: null,
        resolved: { source: null, url: null },
        storage: SANDBOX,
      }),
    ).toEqual({ source: "storage", downloadUrl: SANDBOX });
  });

  it("is manual without a URL when no source serves the file", () => {
    expect(
      pickFileSource({ curseforge: null, resolved: null, storage: null }),
    ).toEqual({ source: "manual", downloadUrl: null });
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
