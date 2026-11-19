import { describe, it, expect } from "vitest";
import {
  curseforgeProjectUrl,
  projectLabel,
} from "@/services/curseforge/project";

const CREATE_PAGE = "https://www.curseforge.com/minecraft/mc-mods/create";
const WORLDS_CLASS = 17;

describe("curseforgeProjectUrl", () => {
  it("is the stored page without a trailing slash", () => {
    expect(
      curseforgeProjectUrl({
        websiteUrl: `${CREATE_PAGE}/`,
        classId: 6,
        slug: "create",
      }),
    ).toBe(CREATE_PAGE);
  });

  it.each([
    [6, "mc-mods"],
    [12, "texture-packs"],
    [6552, "shaders"],
    [4471, "modpacks"],
    [6945, "data-packs"],
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

  it("encodes the slug into the built page", () => {
    expect(
      curseforgeProjectUrl({ websiteUrl: null, classId: 6, slug: "a b" }),
    ).toBe("https://www.curseforge.com/minecraft/mc-mods/a%20b");
  });

  it.each([null, ""])(
    "has no page for a class without a site path when the stored page is %j",
    (websiteUrl) => {
      expect(
        curseforgeProjectUrl({
          websiteUrl,
          classId: WORLDS_CLASS,
          slug: "some-world",
        }),
      ).toBeNull();
    },
  );
});

describe("projectLabel", () => {
  it("is the project's name when it has one", () => {
    expect(projectLabel("Create", 328085)).toBe("Create");
  });

  it.each([null, undefined])("is the id when the name is %j", (name) => {
    expect(projectLabel(name, 328085)).toBe("#328085");
  });
});
