import { describe, it, expect } from "vitest";
import {
  CHANGELOG_MARKDOWN_MAX_LENGTH,
  renderChangelogMarkdown,
  type ChangelogMarkdownSection,
} from "@/services/modpack/changelog-markdown";
import type {
  ChangelogEntry,
  ChangelogInput,
} from "@/discord/components/presets/modpack-changelog";

const ROWS = "https://createrington.com/api/modpacks/77/changelog/rows";

function entry(
  index: number,
  overrides: Partial<ChangelogEntry> = {},
): ChangelogEntry {
  return {
    projectId: 1000 + index,
    name: `Mod ${index}`,
    url: `https://www.curseforge.com/minecraft/mc-mods/mod-${index}`,
    thumbnailUrl: null,
    classId: 6,
    disabled: false,
    label: `mod-${index}-1.0.${index}`,
    previousLabel: null,
    ...overrides,
  };
}

function entries(count: number, offset = 0): ChangelogEntry[] {
  return Array.from({ length: count }, (_, i) => entry(offset + i + 1));
}

function section(
  label: string,
  overrides: Partial<ChangelogInput> = {},
  fileId = 500,
): ChangelogMarkdownSection {
  return {
    rowImageBaseUrl: `${ROWS}/${fileId}`,
    changelog: {
      release: {
        title: `Rails n Sails ${label}`,
        label,
        titleImageUrl: null,
        minecraftVersion: "1.21.1",
        modLoader: "NeoForge 21.1.172",
        modCount: 214,
        publishedAt: new Date("2030-01-01T00:00:00Z"),
        downloadUrl: null,
      },
      previousVersion: "1.2.0",
      added: [],
      updated: [],
      removed: [],
      unchanged: 200,
      notes: null,
      ...overrides,
    },
  };
}

function render(
  latest: ChangelogMarkdownSection,
  installed: ChangelogMarkdownSection | null = null,
) {
  return renderChangelogMarkdown({ latest, installed });
}

function rowLines(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("[![](") || line.startsWith("![]("));
}

describe("renderChangelogMarkdown", () => {
  it("renders the newest release with a linked row image per change", () => {
    const markdown = render(
      section("1.3.0", {
        added: [entry(1)],
        updated: [entry(2, { previousLabel: "mod-2-0.9" })],
        removed: [entry(3, { url: null })],
      }),
    );

    expect(markdown).toBe(
      [
        "## What's new in 1.3.0",
        "%#AAAAAA%1 Jan 2030 · since 1.2.0%#%",
        "",
        "### Added (1)",
        `[![](${ROWS}/500/1001.png)](https://www.curseforge.com/minecraft/mc-mods/mod-1)`,
        "",
        "### Updated (1)",
        `[![](${ROWS}/500/1002.png)](https://www.curseforge.com/minecraft/mc-mods/mod-2)`,
        "",
        "### Removed (1)",
        `![](${ROWS}/500/1003.png)`,
        "",
      ].join("\n"),
    );
  });

  it("marks the first recorded release instead of listing every mod", () => {
    const markdown = render(
      section("1.0.0", { previousVersion: null, unchanged: 214 }),
    );

    expect(markdown).toBe(
      [
        "## What's new in 1.0.0",
        "%#AAAAAA%1 Jan 2030 · first recorded release%#%",
        "",
      ].join("\n"),
    );
  });

  it("leaves the date out when the release has none", () => {
    const base = section("1.3.0");
    base.changelog.release.publishedAt = null;

    expect(render(base).split("\n")[1]).toBe("%#AAAAAA%since 1.2.0%#%");
  });

  it("says so when a release changed no mods", () => {
    expect(render(section("1.3.0"))).toContain(
      "\n\nNo mod changes in this release.\n",
    );
  });

  it("appends the publish notes under their own heading", () => {
    const markdown = render(
      section("1.3.0", {
        added: [entry(1)],
        notes: "  Rebalanced **ores**.\n§cDelete configs.  ",
      }),
    );

    expect(
      markdown.endsWith(
        "\n\n### Additional notes\nRebalanced **ores**.\ncDelete configs.\n",
      ),
    ).toBe(true);
  });

  it("follows an older installed release under an outdated label", () => {
    const markdown = render(
      section("1.3.0", { added: [entry(1)] }, 500),
      section("1.1.0", { previousVersion: "1.0.0", added: [entry(9)] }, 300),
    );

    const [newest, installed] = markdown.split("\n---\n");
    expect(newest.split("\n").slice(0, 3)).toEqual([
      "## What's new in 1.3.0",
      "%#FFAA00%You're on 1.1.0. Update the pack to get these changes.%#%",
      "%#AAAAAA%1 Jan 2030 · since 1.2.0%#%",
    ]);
    expect(rowLines(newest)).toEqual([
      `[![](${ROWS}/500/1001.png)](https://www.curseforge.com/minecraft/mc-mods/mod-1)`,
    ]);
    expect(installed.split("\n").slice(1, 3)).toEqual([
      "## Your version: 1.1.0",
      "%#FFAA00%Outdated · 1 Jan 2030 · since 1.0.0%#%",
    ]);
    expect(rowLines(installed)).toEqual([
      `[![](${ROWS}/300/1009.png)](https://www.curseforge.com/minecraft/mc-mods/mod-9)`,
    ]);
  });

  it("keeps release labels from triggering FancyMenu formatting", () => {
    const markdown = render(section("[beta]_1*0~`x` 100% &rbuild;;§a\\n"));

    expect(markdown.split("\n")[0]).toBe(
      "## What's new in (beta)\\_1\\*0\\~\\`x\\` 100％ ＆rbuild;an",
    );
  });

  it("escapes parentheses in link targets", () => {
    const markdown = render(
      section("1.3.0", {
        added: [
          entry(1, {
            url: "https://www.curseforge.com/minecraft/mc-mods/a(b)",
          }),
        ],
      }),
    );

    expect(rowLines(markdown)).toEqual([
      `[![](${ROWS}/500/1001.png)](https://www.curseforge.com/minecraft/mc-mods/a%28b%29)`,
    ]);
  });

  it("drops the links before trimming a changelog that would be too long", () => {
    const markdown = render(section("1.3.0", { updated: entries(150) }));

    expect(markdown.length).toBeLessThanOrEqual(CHANGELOG_MARKDOWN_MAX_LENGTH);
    expect(markdown).not.toContain("[![](");
    expect(rowLines(markdown)).toHaveLength(150);
    expect(markdown).not.toContain("more%#%");
  });

  it("caps every change group once dropping links is not enough", () => {
    const markdown = render(
      section("1.3.0", { added: entries(400), updated: entries(10, 400) }),
      section("1.1.0", { removed: entries(400, 500) }, 300),
    );

    expect(markdown.length).toBeLessThanOrEqual(CHANGELOG_MARKDOWN_MAX_LENGTH);
    expect(markdown).toContain("### Added (400)");
    expect(markdown).toMatch(/^%#AAAAAA%…and \d+ more%#%$/m);
    expect(markdown).toContain(`${ROWS}/500/1410.png`);
    expect(markdown).toContain("## Your version: 1.1.0");
    expect(markdown).toContain("### Removed (400)");
    const [newest, installed] = markdown.split("\n---\n");
    const shownAdded = rowLines(newest.split("### Updated")[0]).length;
    expect(shownAdded).toBeGreaterThan(10);
    expect(rowLines(installed)).toHaveLength(shownAdded);
  });
});
