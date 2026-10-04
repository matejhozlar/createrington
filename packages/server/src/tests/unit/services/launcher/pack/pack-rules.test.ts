import { describe, it, expect } from "vitest";
import {
  curseforgeCdnUrl,
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

describe("curseforgeCdnUrl", () => {
  it("splits the file id into thousands and remainder", () => {
    expect(curseforgeCdnUrl(8584761, "create-collision-fix-1.0.1.jar")).toBe(
      "https://mediafilez.forgecdn.net/files/8584/761/create-collision-fix-1.0.1.jar",
    );
  });

  it.each([
    [8664066, "8664/66"],
    [8350073, "8350/73"],
    [8350007, "8350/7"],
    [8350000, "8350/0"],
  ])(
    "writes the remainder of file %i without leading zeros",
    (fileId, path) => {
      expect(curseforgeCdnUrl(fileId, "mod.jar")).toBe(
        `https://mediafilez.forgecdn.net/files/${path}/mod.jar`,
      );
    },
  );

  it("percent-encodes spaces, plus signs and parentheses in the file name", () => {
    expect(curseforgeCdnUrl(7001234, "Some Mod+Addon (NeoForge) 1.0.jar")).toBe(
      "https://mediafilez.forgecdn.net/files/7001/234/Some%20Mod%2BAddon%20%28NeoForge%29%201.0.jar",
    );
  });

  it("keeps a file name with a slash inside one path segment", () => {
    expect(curseforgeCdnUrl(7001234, "a/b.jar")).toBe(
      "https://mediafilez.forgecdn.net/files/7001/234/a%2Fb.jar",
    );
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
        modrinth: MR,
        curseforgeCdn: CDN,
        storage: SANDBOX,
      }),
    ).toEqual({ source: "curseforge", downloadUrl: CF });
  });

  it("falls back to Modrinth for a file CurseForge blocks", () => {
    expect(
      pickFileSource({
        curseforge: null,
        modrinth: MR,
        curseforgeCdn: CDN,
        storage: SANDBOX,
      }),
    ).toEqual({ source: "modrinth", downloadUrl: MR });
  });

  it("falls back to the built CDN address when Modrinth has no copy", () => {
    expect(
      pickFileSource({
        curseforge: null,
        modrinth: null,
        curseforgeCdn: CDN,
        storage: SANDBOX,
      }),
    ).toEqual({ source: "curseforge-cdn", downloadUrl: CDN });
  });

  it("falls back to the sandbox copy when the built address is not usable", () => {
    expect(
      pickFileSource({
        curseforge: null,
        modrinth: null,
        curseforgeCdn: null,
        storage: SANDBOX,
      }),
    ).toEqual({ source: "storage", downloadUrl: SANDBOX });
  });

  it("is manual without a URL when no source serves the file", () => {
    expect(
      pickFileSource({
        curseforge: null,
        modrinth: null,
        curseforgeCdn: null,
        storage: null,
      }),
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

describe("curseforgeFilePageUrl", () => {
  it("links the file page of the project", () => {
    expect(
      curseforgeFilePageUrl(
        {
          websiteUrl:
            "https://www.curseforge.com/minecraft/mc-mods/create-aeronautics/",
          classId: 6,
          slug: "create-aeronautics",
        },
        7001234,
      ),
    ).toBe(
      "https://www.curseforge.com/minecraft/mc-mods/create-aeronautics/files/7001234",
    );
  });

  it.each([
    [6, "mc-mods"],
    [12, "texture-packs"],
    [6552, "shaders"],
  ])(
    "builds the page from the slug when a class %i project has no stored page",
    (classId, sitePath) => {
      expect(
        curseforgeFilePageUrl(
          { websiteUrl: null, classId, slug: "some-project" },
          7001234,
        ),
      ).toBe(
        `https://www.curseforge.com/minecraft/${sitePath}/some-project/files/7001234`,
      );
    },
  );

  it("has no page for a class the launcher does not install", () => {
    expect(
      curseforgeFilePageUrl(
        { websiteUrl: null, classId: 6945, slug: "some-pack" },
        7001234,
      ),
    ).toBeNull();
  });
});
