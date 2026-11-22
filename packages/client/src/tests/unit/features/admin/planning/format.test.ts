import { describe, expect, it } from "vitest";
import { markdownPreview } from "@/features/admin/planning/format";

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
