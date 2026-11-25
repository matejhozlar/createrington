import { describe, expect, it } from "vitest";
import {
  describeRevision,
  markdownPreview,
  subcategoriesWithin,
} from "@/features/admin/planning/format";
import type {
  PlanningRevision,
  PlanningSubcategory,
} from "@/features/admin/planning/types";

describe("markdownPreview", () => {
  it("returns an empty string when there is no description", () => {
    expect(markdownPreview(null)).toBe("");
    expect(markdownPreview("")).toBe("");
  });

  it("reads headings, lists and emphasis as plain sentences", () => {
    expect(
      markdownPreview(
        "## Why\n\nMoney has **no** use and `/pay` is _rare_.\n\n- First option\n- [ ] Ask the team\n1. Numbered",
      ),
    ).toBe(
      "Why Money has no use and /pay is rare. First option Ask the team Numbered",
    );
  });

  it("keeps the text of a link and drops images and code blocks", () => {
    expect(
      markdownPreview(
        "See [the wiki](https://example.com).\n\n![chart](https://example.com/a.png)\n\n```ts\nconst a = 1;\n```\n\nDone.",
      ),
    ).toBe("See the wiki. Done.");
  });

  it("reads a table as its cell texts", () => {
    expect(
      markdownPreview(
        "| Option | Effort |\n| --- | :---: |\n| Player shops | High |",
      ),
    ).toBe("Option Effort Player shops High");
  });

  it("cuts a long description to the preview length", () => {
    expect(markdownPreview("word ".repeat(200))).toHaveLength(320);
  });
});

const SUBCATEGORIES = [
  { id: 4, category: "modpack", name: "Economy", itemCount: 0 },
  { id: 5, category: "modpack", name: "Quests", itemCount: 0 },
  { id: 9, category: "website", name: "Launcher", itemCount: 0 },
] as PlanningSubcategory[];

function revision(fields: Partial<PlanningRevision>): PlanningRevision {
  return {
    id: 1,
    revision: 1,
    title: "Rework the economy",
    body: null,
    status: "draft",
    categories: ["modpack"],
    subcategoryIds: [4],
    createdAt: "2026-11-24T12:00:00.000Z",
    editedBy: { discordId: "1", minecraftUsername: null, minecraftUuid: null },
    ...fields,
  };
}

describe("describeRevision", () => {
  it("lists the categories and subcategories a save added and removed", () => {
    const previous = revision({});
    const next = revision({
      categories: ["website", "discord"],
      subcategoryIds: [9],
    });

    expect(describeRevision(next, previous, SUBCATEGORIES)).toEqual([
      "Added to Website and Discord",
      "Removed from Modpack",
      "Filed under Launcher",
      "Taken out of Economy",
    ]);
  });

  it("reports nothing about categories when only the order differs", () => {
    const previous = revision({ categories: ["modpack", "website"] });
    const next = revision({ categories: ["website", "modpack"] });

    expect(describeRevision(next, previous, SUBCATEGORIES)).toEqual([]);
  });
});

describe("subcategoriesWithin", () => {
  it("drops the subcategories of a category that is no longer chosen", () => {
    expect(subcategoriesWithin(["website"], [4, 9], SUBCATEGORIES)).toEqual([
      9,
    ]);
  });

  it("keeps subcategories it cannot place yet, such as while the list loads", () => {
    expect(subcategoriesWithin(["website"], [4, 9], [])).toEqual([4, 9]);
  });
});
