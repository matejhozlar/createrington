import { describe, it, expect } from "vitest";
import type {
  CurseforgeFileProject,
  CurseforgeFileWithProject,
} from "@/db/queries/curseforge/file";
import {
  contentKindForClass,
  curseforgeFilePageUrl,
  curseforgeProjectUrl,
  toLauncherContentFile,
  toLauncherProject,
} from "@/services/launcher/content/curseforge-content";

const CREATE_PAGE = "https://www.curseforge.com/minecraft/mc-mods/create";

function makeProject(
  overrides: Partial<CurseforgeFileProject> = {},
): CurseforgeFileProject {
  return {
    id: 328085,
    classId: 6,
    slug: "create",
    name: "Create",
    summary: "Aesthetic technology that empowers the player",
    thumbnailUrl:
      "https://media.forgecdn.net/avatars/thumbnails/1/2/64/64/a.png",
    websiteUrl: CREATE_PAGE,
    primaryAuthor: "simibubi",
    ...overrides,
  };
}

function makeFile(
  overrides: Partial<CurseforgeFileWithProject> = {},
): CurseforgeFileWithProject {
  return {
    id: 7000001,
    curseforgeProjectId: 328085,
    fileName: "create-1.21.1-6.0.10.jar",
    fileSize: 17654321,
    sha1: "e".repeat(40),
    source: "curseforge",
    downloadUrl:
      "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
    resolvedAt: new Date("2026-10-05T00:00:00Z"),
    project: makeProject(),
    ...overrides,
  };
}

describe("contentKindForClass", () => {
  it.each([
    [6, "mod"],
    [12, "resourcepack"],
    [6552, "shader"],
  ])("reads class %i as a %s", (classId, kind) => {
    expect(contentKindForClass(classId)).toBe(kind);
  });

  it.each([4471, 6945, 17, 0])("has no kind for class %i", (classId) => {
    expect(contentKindForClass(classId)).toBeNull();
  });
});

describe("curseforgeProjectUrl", () => {
  it("is the stored page without a trailing slash", () => {
    expect(
      curseforgeProjectUrl(makeProject({ websiteUrl: `${CREATE_PAGE}/` })),
    ).toBe(CREATE_PAGE);
  });

  it.each([
    [6, "mc-mods"],
    [12, "texture-packs"],
    [6552, "shaders"],
  ])(
    "builds the page from the slug when a class %i project has no stored page",
    (classId, sitePath) => {
      expect(
        curseforgeProjectUrl({
          websiteUrl: null,
          classId,
          slug: "some-project",
        }),
      ).toBe(`https://www.curseforge.com/minecraft/${sitePath}/some-project`);
    },
  );

  it("has no page for a class the launcher does not install", () => {
    expect(
      curseforgeProjectUrl({
        websiteUrl: null,
        classId: 6945,
        slug: "some-pack",
      }),
    ).toBeNull();
  });
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

  it("builds the file page from the slug when the project has no stored page", () => {
    expect(
      curseforgeFilePageUrl(
        { websiteUrl: null, classId: 12, slug: "some-project" },
        7001234,
      ),
    ).toBe(
      "https://www.curseforge.com/minecraft/texture-packs/some-project/files/7001234",
    );
  });

  it("has no file page for a class the launcher does not install", () => {
    expect(
      curseforgeFilePageUrl(
        { websiteUrl: null, classId: 6945, slug: "some-pack" },
        7001234,
      ),
    ).toBeNull();
  });
});

describe("toLauncherProject", () => {
  it("describes a CurseForge project with its id as a string", () => {
    expect(toLauncherProject(makeProject())).toEqual({
      source: "curseforge",
      id: "328085",
      slug: "create",
      kind: "mod",
      name: "Create",
      summary: "Aesthetic technology that empowers the player",
      author: "simibubi",
      iconUrl: "https://media.forgecdn.net/avatars/thumbnails/1/2/64/64/a.png",
      url: CREATE_PAGE,
    });
  });

  it("keeps a project without summary, author, picture or stored page", () => {
    expect(
      toLauncherProject(
        makeProject({
          classId: 6552,
          slug: "some-shader",
          summary: null,
          thumbnailUrl: null,
          websiteUrl: null,
          primaryAuthor: null,
        }),
      ),
    ).toMatchObject({
      kind: "shader",
      summary: null,
      author: null,
      iconUrl: null,
      url: "https://www.curseforge.com/minecraft/shaders/some-shader",
    });
  });

  it("has no project for a class the launcher does not install", () => {
    expect(toLauncherProject(makeProject({ classId: 4471 }))).toBeNull();
  });
});

describe("toLauncherContentFile", () => {
  it("names the file by its CurseForge ids and says who serves it", () => {
    expect(toLauncherContentFile(makeFile())).toEqual({
      source: "curseforge",
      projectId: "328085",
      id: "7000001",
      fileName: "create-1.21.1-6.0.10.jar",
      size: 17654321,
      sha1: "e".repeat(40),
      pageUrl: `${CREATE_PAGE}/files/7000001`,
      download: {
        servedBy: "curseforge",
        url: "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
      },
    });
  });

  it("stays a CurseForge file when Modrinth serves the bytes", () => {
    const modrinthUrl =
      "https://cdn.modrinth.com/data/abc/versions/def/create-1.21.1-6.0.10.jar";

    expect(
      toLauncherContentFile(
        makeFile({ source: "modrinth", downloadUrl: modrinthUrl }),
      ),
    ).toMatchObject({
      source: "curseforge",
      projectId: "328085",
      id: "7000001",
      download: { servedBy: "modrinth", url: modrinthUrl },
    });
  });

  it("has no address for a file no source serves", () => {
    expect(
      toLauncherContentFile(makeFile({ source: "manual", downloadUrl: null }))
        ?.download,
    ).toEqual({ servedBy: "manual", url: null });
  });

  it("has no file for a class the launcher does not install", () => {
    expect(
      toLauncherContentFile(
        makeFile({
          project: makeProject({ classId: 6945, websiteUrl: null }),
        }),
      ),
    ).toBeNull();
  });
});
