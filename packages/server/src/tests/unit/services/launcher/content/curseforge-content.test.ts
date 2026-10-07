import { describe, it, expect } from "vitest";
import type {
  CurseforgeFileProject,
  CurseforgeFileWithProject,
} from "@/db/queries/curseforge/file";
import type { CurseForgeContentFile } from "@/services/curseforge";
import {
  classForContentKind,
  contentKindForClass,
  curseforgeFilePageUrl,
  curseforgeProjectUrl,
  sortFieldForContentSort,
  toLauncherContentCategory,
  toLauncherContentFile,
  toLauncherContentFileDetails,
  toLauncherProject,
  toLauncherProjectLatestFiles,
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

  it.each(["", "/"])(
    "builds the page from the slug when the stored page is %j",
    (websiteUrl) => {
      expect(
        curseforgeProjectUrl({ websiteUrl, classId: 6, slug: "some-project" }),
      ).toBe("https://www.curseforge.com/minecraft/mc-mods/some-project");
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

  it("has no page for an empty stored page of a class the launcher does not install", () => {
    expect(
      curseforgeProjectUrl({
        websiteUrl: "",
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

describe("sortFieldForContentSort", () => {
  it.each([
    ["relevance", 2],
    ["downloads", 6],
    ["newest", 11],
    ["updated", 3],
  ] as const)("sorts by %s with CurseForge field %i", (sort, field) => {
    expect(sortFieldForContentSort(sort)).toBe(field);
  });
});

describe("toLauncherContentCategory", () => {
  const technology = {
    id: 412,
    name: "Technology",
    slug: "technology",
    iconUrl: "https://media.forgecdn.net/avatars/technology.png",
    parentCategoryId: 6,
  };

  it("has no parent for a category that sits right under its class", () => {
    expect(toLauncherContentCategory(technology, 6)).toEqual({
      id: "412",
      name: "Technology",
      slug: "technology",
      iconUrl: "https://media.forgecdn.net/avatars/technology.png",
      parentId: null,
    });
  });

  it("names the category a nested one sits under", () => {
    expect(
      toLauncherContentCategory(
        {
          id: 417,
          name: "Energy",
          slug: "technology-energy",
          iconUrl: null,
          parentCategoryId: 412,
        },
        6,
      ),
    ).toEqual({
      id: "417",
      name: "Energy",
      slug: "technology-energy",
      iconUrl: null,
      parentId: "412",
    });
  });

  it("has no parent when CurseForge names none", () => {
    expect(
      toLauncherContentCategory({ ...technology, parentCategoryId: null }, 6)
        .parentId,
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

  it("keeps a project whose stored page is empty, with the page built from its slug", () => {
    expect(toLauncherProject(makeProject({ websiteUrl: "" }))?.url).toBe(
      CREATE_PAGE,
    );
  });

  it("has no project for a class the launcher does not install", () => {
    expect(toLauncherProject(makeProject({ classId: 4471 }))).toBeNull();
  });
});

describe("toLauncherProjectLatestFiles", () => {
  it("names each file by its id as a string, with its version, loader and release type", () => {
    expect(
      toLauncherProjectLatestFiles([
        {
          gameVersion: "1.21.1",
          fileId: 7000001,
          filename: "create-1.21.1-6.0.10.jar",
          releaseType: 1,
          modLoader: 6,
        },
        {
          gameVersion: "1.20.1",
          fileId: 6000002,
          filename: "create-1.20.1-6.0.9-beta.jar",
          releaseType: 2,
          modLoader: 1,
        },
        {
          gameVersion: "1.20.1",
          fileId: 6000003,
          filename: "create-fabric-1.20.1-6.0.9-alpha.jar",
          releaseType: 3,
          modLoader: 4,
        },
        {
          gameVersion: "1.20.1",
          fileId: 6000004,
          filename: "create-quilt-1.20.1-6.0.9.jar",
          releaseType: 1,
          modLoader: 5,
        },
      ]),
    ).toEqual([
      {
        fileId: "7000001",
        fileName: "create-1.21.1-6.0.10.jar",
        gameVersion: "1.21.1",
        loader: "neoforge",
        releaseType: "release",
      },
      {
        fileId: "6000002",
        fileName: "create-1.20.1-6.0.9-beta.jar",
        gameVersion: "1.20.1",
        loader: "forge",
        releaseType: "beta",
      },
      {
        fileId: "6000003",
        fileName: "create-fabric-1.20.1-6.0.9-alpha.jar",
        gameVersion: "1.20.1",
        loader: "fabric",
        releaseType: "alpha",
      },
      {
        fileId: "6000004",
        fileName: "create-quilt-1.20.1-6.0.9.jar",
        gameVersion: "1.20.1",
        loader: "quilt",
        releaseType: "release",
      },
    ]);
  });

  it.each([[null], [0], [3]])(
    "has no loader for a file CurseForge lists under loader %s",
    (modLoader) => {
      expect(
        toLauncherProjectLatestFiles([
          {
            gameVersion: "1.21.1",
            fileId: 5000001,
            filename: "faithful-32x-1.21.1.zip",
            releaseType: 1,
            modLoader,
          },
        ]),
      ).toEqual([
        {
          fileId: "5000001",
          fileName: "faithful-32x-1.21.1.zip",
          gameVersion: "1.21.1",
          loader: null,
          releaseType: "release",
        },
      ]);
    },
  );

  it("reads a release type it does not know as a release", () => {
    expect(
      toLauncherProjectLatestFiles([
        {
          gameVersion: "1.21.1",
          fileId: 5000001,
          filename: "some-mod-1.21.1.jar",
          releaseType: 9,
          modLoader: 6,
        },
      ])[0].releaseType,
    ).toBe("release");
  });

  it("answers an empty list for a project without files", () => {
    expect(toLauncherProjectLatestFiles([])).toEqual([]);
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

describe("classForContentKind", () => {
  it.each([
    ["mod", 6],
    ["resourcepack", 12],
    ["shader", 6552],
  ] as const)("looks a %s up in class %i", (kind, classId) => {
    expect(classForContentKind(kind)).toBe(classId);
    expect(contentKindForClass(classId)).toBe(kind);
  });
});

describe("toLauncherContentFileDetails", () => {
  function makeContentFile(
    overrides: Partial<CurseForgeContentFile> = {},
  ): CurseForgeContentFile {
    return {
      id: 7000001,
      projectId: 439890,
      gameId: 432,
      displayName: "Create Crafts & Additions 1.7.2",
      fileName: "createaddition-1.7.2.jar",
      fileDate: "2026-03-01T10:00:00.000Z",
      releaseType: 2,
      downloadUrl:
        "https://edge.forgecdn.net/files/7000/1/createaddition-1.7.2.jar",
      fileLength: 1234,
      sha1: "a".repeat(40),
      gameVersions: ["Client", "1.21.1", "NeoForge", "Server", "1.21"],
      dependencies: [
        { projectId: 238222, required: false },
        { projectId: 328085, required: true },
      ],
      ...overrides,
    };
  }

  const PROJECT_PAGE =
    "https://www.curseforge.com/minecraft/mc-mods/createaddition";

  it("describes a file with its versions, loaders and dependencies", () => {
    expect(
      toLauncherContentFileDetails(makeContentFile(), PROJECT_PAGE),
    ).toEqual({
      source: "curseforge",
      projectId: "439890",
      id: "7000001",
      fileName: "createaddition-1.7.2.jar",
      size: 1234,
      sha1: "a".repeat(40),
      pageUrl: `${PROJECT_PAGE}/files/7000001`,
      download: {
        servedBy: "curseforge",
        url: "https://edge.forgecdn.net/files/7000/1/createaddition-1.7.2.jar",
      },
      displayName: "Create Crafts & Additions 1.7.2",
      releaseType: "beta",
      publishedAt: "2026-03-01T10:00:00.000Z",
      gameVersions: ["1.21.1", "1.21"],
      loaders: ["neoforge"],
      dependencies: [
        { source: "curseforge", projectId: "238222", required: false },
        { source: "curseforge", projectId: "328085", required: true },
      ],
    });
  });

  it("is manual without an address when CurseForge gives no download link", () => {
    expect(
      toLauncherContentFileDetails(
        makeContentFile({ downloadUrl: null }),
        PROJECT_PAGE,
      )?.download,
    ).toEqual({ servedBy: "manual", url: null });
  });

  it.each([
    [1, "release"],
    [2, "beta"],
    [3, "alpha"],
    [null, "release"],
    [9, "release"],
  ])("reads release type %j as %s", (releaseType, expected) => {
    expect(
      toLauncherContentFileDetails(
        makeContentFile({ releaseType }),
        PROJECT_PAGE,
      )?.releaseType,
    ).toBe(expected);
  });

  it("names a file without a display name by its file name", () => {
    expect(
      toLauncherContentFileDetails(
        makeContentFile({ displayName: null }),
        PROJECT_PAGE,
      )?.displayName,
    ).toBe("createaddition-1.7.2.jar");
  });

  it("lists every loader a file is tagged with and none for a loaderless one", () => {
    expect(
      toLauncherContentFileDetails(
        makeContentFile({
          gameVersions: ["Fabric", "1.20.1", "Quilt", "Forge"],
        }),
        PROJECT_PAGE,
      )?.loaders,
    ).toEqual(["fabric", "quilt", "forge"]);
    expect(
      toLauncherContentFileDetails(
        makeContentFile({ gameVersions: ["1.21.1"] }),
        PROJECT_PAGE,
      )?.loaders,
    ).toEqual([]);
  });

  it.each([
    ["no file name", { fileName: null }],
    ["no size", { fileLength: null }],
    ["no SHA-1", { sha1: null }],
  ])("has no file when CurseForge gives %s", (_label, overrides) => {
    expect(
      toLauncherContentFileDetails(makeContentFile(overrides), PROJECT_PAGE),
    ).toBeNull();
  });
});
