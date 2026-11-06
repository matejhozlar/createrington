import { describe, it, expect } from "vitest";
import {
  CHANGELOG_MARKDOWN_MAX_LENGTH,
  CHANGELOG_ROWS_PER_GROUP_MAX,
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

  it("shows at most CHANGELOG_ROWS_PER_GROUP_MAX rows per group", () => {
    const markdown = render(
      section("1.3.0", {
        added: entries(CHANGELOG_ROWS_PER_GROUP_MAX + 5),
        updated: entries(3, 100),
      }),
    );

    const added = markdown.split("### Updated")[0];
    expect(rowLines(added)).toHaveLength(CHANGELOG_ROWS_PER_GROUP_MAX);
    expect(added).toContain("%#AAAAAA%…and 5 more%#%");
    expect(rowLines(markdown.split("### Updated")[1])).toHaveLength(3);
    expect(markdown).toContain("[![](");
  });

  it("drops the links before trimming a changelog that would be too long", () => {
    const full = {
      added: entries(CHANGELOG_ROWS_PER_GROUP_MAX),
      updated: entries(CHANGELOG_ROWS_PER_GROUP_MAX, 100),
      removed: entries(CHANGELOG_ROWS_PER_GROUP_MAX, 200),
    };
    const markdown = render(
      section("1.3.0", full),
      section("1.1.0", full, 300),
    );

    expect(markdown.length).toBeLessThanOrEqual(CHANGELOG_MARKDOWN_MAX_LENGTH);
    expect(markdown).not.toContain("[![](");
    expect(rowLines(markdown)).toHaveLength(6 * CHANGELOG_ROWS_PER_GROUP_MAX);
    expect(markdown).not.toContain("more%#%");
  });

  it("lowers the per-group cap evenly once dropping links is not enough", () => {
    const longBase = `${ROWS}/${"9".repeat(200)}`;
    const newest = section("1.3.0", {
      added: entries(400),
      updated: entries(10, 400),
    });
    const installed = section("1.1.0", { removed: entries(400, 500) }, 300);
    newest.rowImageBaseUrl = longBase;
    installed.rowImageBaseUrl = longBase;

    const markdown = render(newest, installed);

    expect(markdown.length).toBeLessThanOrEqual(CHANGELOG_MARKDOWN_MAX_LENGTH);
    expect(markdown).toContain("### Added (400)");
    expect(markdown).toContain("## Your version: 1.1.0");
    expect(markdown).toContain("### Removed (400)");
    const [top, bottom] = markdown.split("\n---\n");
    const shownAdded = rowLines(top.split("### Updated")[0]).length;
    expect(shownAdded).toBeGreaterThan(0);
    expect(shownAdded).toBeLessThan(CHANGELOG_ROWS_PER_GROUP_MAX);
    expect(rowLines(bottom)).toHaveLength(shownAdded);
  });

  it("stays within the budget with the longest notes and groups in both sections", () => {
    const worst = {
      added: entries(400),
      updated: entries(400, 400),
      removed: entries(400, 800),
      notes: "n".repeat(10_000),
    };
    const newest = section("x".repeat(200), worst);
    const installed = section("y".repeat(200), worst, 300);
    newest.rowImageBaseUrl = `${ROWS}/${"9".repeat(2_000)}`;
    installed.rowImageBaseUrl = newest.rowImageBaseUrl;

    const markdown = render(newest, installed);

    expect(markdown.length).toBeLessThanOrEqual(CHANGELOG_MARKDOWN_MAX_LENGTH);
  });

  it("keeps one note line's stray markers from formatting the rest of the text", () => {
    const markdown = render(
      section("1.3.0", {
        notes: [
          "Keep **bold** and *italic* when they pair up.",
          "Set max_speed to 50% in create-server.toml",
          "2 * 3 = 6 and ~approx `code",
        ].join("\n"),
      }),
    );

    expect(markdown).toContain(
      [
        "### Additional notes",
        "Keep **bold** and *italic* when they pair up.",
        "Set max\\_speed to 50％ in create-server.toml",
        "2 \\* 3 = 6 and \\~approx \\`code",
      ].join("\n"),
    );
  });

  it("never cuts a label in half of a surrogate pair", () => {
    const label = `${"a".repeat(58)}😀bb`;
    const heading = render(section(label)).split("\n")[0];

    expect(heading).toBe(`## What's new in ${"a".repeat(58)}😀…`);
    const lone = Array.from(heading).filter((char) => {
      const code = char.charCodeAt(0);
      return char.length === 1 && code >= 0xd800 && code <= 0xdfff;
    });
    expect(lone).toEqual([]);
  });
});
