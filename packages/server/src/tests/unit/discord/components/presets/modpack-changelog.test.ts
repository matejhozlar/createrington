import { describe, it, expect } from "vitest";
import {
  ModpackChangelogComponentPresets,
  type ChangelogEntry,
  type ChangelogInput,
} from "@/discord/components/presets/modpack-changelog";
import { validateComponentsV2 } from "@/discord/components";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

type Child = ComponentContainer["components"][number];

function entry(
  index: number,
  overrides: Partial<ChangelogEntry> = {},
): ChangelogEntry {
  return {
    name: `Mod ${index}`,
    url: `https://www.curseforge.com/minecraft/mc-mods/mod-${index}`,
    thumbnailUrl: `https://media.forgecdn.net/avatars/mod-${index}.png`,
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

function input(overrides: Partial<ChangelogInput> = {}): ChangelogInput {
  return {
    release: {
      title: "Rails n Sails 1.3.0",
      label: "1.3.0",
      titleImageUrl: null,
      minecraftVersion: "1.21.1",
      modLoader: "NeoForge 21.1.172",
      modCount: 214,
      publishedAt: new Date("2030-01-01T00:00:00Z"),
      downloadUrl:
        "https://www.curseforge.com/minecraft/modpacks/rails-n-sails/files/1",
    },
    previousVersion: "1.2.0",
    added: [],
    updated: [],
    removed: [],
    unchanged: 200,
    ...overrides,
  };
}

function children(message: ComponentsData): Child[] {
  const [root] = message.components;
  if (root.type !== "container") throw new Error("expected a container");
  return root.components;
}

function texts(nodes: Child[]): string[] {
  return nodes.flatMap((node) => {
    if (node.type === "text") return [node.content];
    if (node.type === "section") return node.components.map((t) => t.content);
    return [];
  });
}

function sections(nodes: Child[]) {
  return nodes.filter((node) => node.type === "section");
}

function headings(nodes: Child[]): string[] {
  return texts(nodes).filter((content) => content.startsWith("### "));
}

function hasDownloadRow(nodes: Child[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "action_row" &&
      node.components.some((button) => button.label.startsWith("Download")),
  );
}

describe("ModpackChangelogComponentPresets.release", () => {
  it("renders a small diff as one message with header, groups, and download", () => {
    const messages = ModpackChangelogComponentPresets.release(
      input({
        added: entries(2),
        updated: [
          entry(3, { label: "mod-3-2.0.0", previousLabel: "mod-3-1.0.0" }),
        ],
        removed: [entry(4, { thumbnailUrl: null })],
      }),
    );

    expect(messages).toHaveLength(1);
    expect(validateComponentsV2(messages[0])).toBeNull();

    const nodes = children(messages[0]);
    const [header] = texts(nodes);
    expect(header).toContain("## Rails n Sails 1.3.0");
    expect(header).toContain("Minecraft 1.21.1");
    expect(header).toContain("NeoForge 21.1.172");
    expect(header).toContain("214 mods");
    expect(header).toContain("Changes since 1.2.0");
    expect(header).toContain("**2 added**");
    expect(header).toContain("**1 updated**");
    expect(header).toContain("**1 removed**");
    expect(header).toContain("200 unchanged");
    expect(header).not.toContain("Part ");

    expect(headings(nodes)).toEqual([
      "### Added (2)",
      "### Updated (1)",
      "### Removed (1)",
    ]);

    const entrySections = sections(nodes);
    expect(entrySections).toHaveLength(4);
    expect(entrySections[0].accessory.type).toBe("thumbnail");
    expect(entrySections[0].components[0].content).toBe(
      "**[Mod 1](https://www.curseforge.com/minecraft/mc-mods/mod-1)**\n`mod-1-1.0.1`",
    );
    expect(entrySections[2].components[0].content).toContain(
      "`mod-3-1.0.0` → `mod-3-2.0.0`",
    );
    expect(entrySections[3].accessory).toMatchObject({
      type: "button",
      label: "CurseForge",
    });
    expect(hasDownloadRow(nodes)).toBe(true);
  });

  it("splits a long diff into several valid messages of the same shape", () => {
    const added = entries(40);
    const updated = entries(30, 40).map((e) => ({
      ...e,
      previousLabel: `${e.label}-old`,
    }));
    const removed = entries(5, 70);
    const messages = ModpackChangelogComponentPresets.release(
      input({ added, updated, removed }),
    );

    expect(messages.length).toBeGreaterThan(1);
    let entriesSeen = 0;
    messages.forEach((message, index) => {
      expect(validateComponentsV2(message)).toBeNull();
      const nodes = children(message);
      const [header] = texts(nodes);
      expect(header).toContain("## Rails n Sails 1.3.0");
      expect(header).toContain(`Part ${index + 1} of ${messages.length}`);
      expect(header).toContain("**40 added**");
      expect(hasDownloadRow(nodes)).toBe(index === messages.length - 1);
      entriesSeen += sections(nodes).length;
    });
    expect(entriesSeen).toBe(75);

    const allHeadings = messages.flatMap((m) => headings(children(m)));
    expect(allHeadings.filter((h) => h === "### Added (40)")).toHaveLength(1);
    expect(allHeadings.filter((h) => h === "### Updated (30)")).toHaveLength(1);
    expect(allHeadings.filter((h) => h === "### Removed (5)")).toHaveLength(1);
    expect(allHeadings.some((h) => h.endsWith("(continued)"))).toBe(true);
    for (const message of messages) {
      const nodes = children(message);
      const [first] = nodes
        .filter((node) => node.type === "text" || node.type === "section")
        .slice(1);
      expect(first.type).toBe("text");
    }
  });

  it("stays within the text ceiling when entries carry long names and versions", () => {
    const long = entries(30).map((e, i) => ({
      ...e,
      name: `${"Very Long Mod Name ".repeat(8)}${i}`,
      label: `${"release-candidate-build-".repeat(4)}${i}`,
      previousLabel: `${"previous-release-candidate-".repeat(4)}${i}`,
    }));
    const messages = ModpackChangelogComponentPresets.release(
      input({ updated: long }),
    );
    for (const message of messages) {
      expect(validateComponentsV2(message)).toBeNull();
    }
    expect(messages.flatMap((m) => sections(children(m)))).toHaveLength(30);
  });

  it("renders an empty diff as a single message without groups", () => {
    const messages = ModpackChangelogComponentPresets.release(input());
    expect(messages).toHaveLength(1);
    const nodes = children(messages[0]);
    expect(headings(nodes)).toEqual([]);
    expect(texts(nodes)).toContain("No mod changes in this release.");
    expect(hasDownloadRow(nodes)).toBe(true);
    expect(validateComponentsV2(messages[0])).toBeNull();
  });

  it("omits the download row and the previous version when unknown", () => {
    const messages = ModpackChangelogComponentPresets.release(
      input({
        release: {
          title: "Rails n Sails",
          label: "Rails n Sails",
          titleImageUrl: null,
          minecraftVersion: null,
          modLoader: null,
          modCount: 1,
          publishedAt: null,
          downloadUrl: null,
        },
        previousVersion: null,
        added: [entry(1, { thumbnailUrl: null, url: null })],
      }),
    );
    const nodes = children(messages[0]);
    const [header] = texts(nodes);
    expect(header).toBe(
      "## Rails n Sails\n-# 1 mod\n**1 added** · **0 updated** · **0 removed** · 200 unchanged",
    );
    expect(hasDownloadRow(nodes)).toBe(false);
    expect(sections(nodes)).toHaveLength(0);
    expect(texts(nodes)).toContain("**Mod 1**\n`mod-1-1.0.1`");
  });

  it("tags non-mod classes and disabled entries and escapes markdown in names", () => {
    const messages = ModpackChangelogComponentPresets.release(
      input({
        added: [
          entry(1, { classId: 6552, name: "Complementary *Shaders*" }),
          entry(2, { disabled: true }),
        ],
        updated: [
          entry(3, {
            label: "Disabled",
            previousLabel: "Enabled",
            disabled: true,
          }),
        ],
      }),
    );
    const bodies = sections(children(messages[0])).map(
      (section) => section.components[0].content,
    );
    expect(bodies[0]).toContain("Complementary \\*Shaders\\*");
    expect(bodies[0]).toContain("· Shader");
    expect(bodies[1]).toContain("· disabled");
    expect(bodies[2]).toContain("`Enabled` → `Disabled`");
  });

  it("keeps a link intact when the project URL contains a closing parenthesis", () => {
    const messages = ModpackChangelogComponentPresets.release(
      input({
        added: [
          entry(1, {
            url: "https://www.curseforge.com/minecraft/mc-mods/mod-(1)",
          }),
        ],
      }),
    );
    const [body] = sections(children(messages[0])).map(
      (section) => section.components[0].content,
    );
    expect(body).toContain(
      "**[Mod 1](https://www.curseforge.com/minecraft/mc-mods/mod-(1%29)**",
    );
  });

  it("opens every part with the title image instead of a heading when the pack has one", () => {
    const banner = "https://assets.createrington.com/titles/rails-n-sails.png";
    const base = input();
    const messages = ModpackChangelogComponentPresets.release({
      ...base,
      release: { ...base.release, titleImageUrl: banner },
      added: entries(40),
    });

    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) {
      expect(validateComponentsV2(message)).toBeNull();
      const [gallery, header] = children(message);
      expect(gallery).toEqual({
        type: "media_gallery",
        items: [
          { url: banner, description: "Rails n Sails 1.3.0", spoiler: false },
        ],
      });
      if (header.type !== "text") throw new Error("expected the header text");
      expect(header.content.startsWith("**1.3.0**\n-# ")).toBe(true);
      expect(header.content).not.toContain("## ");
    }
  });

  it("clips an absurd release title and label so the header stays valid", () => {
    const base = input();
    const messages = ModpackChangelogComponentPresets.release({
      ...base,
      release: {
        ...base.release,
        title: "T".repeat(3000),
        label: "L".repeat(500),
        titleImageUrl: "https://assets.createrington.com/titles/x.png",
      },
      previousVersion: "P".repeat(500),
      added: entries(1),
    });
    expect(messages).toHaveLength(1);
    expect(validateComponentsV2(messages[0])).toBeNull();
    const [gallery, header] = children(messages[0]);
    if (gallery.type !== "media_gallery") throw new Error("expected a gallery");
    expect(gallery.items[0].description!.length).toBeLessThanOrEqual(1024);
    if (header.type !== "text") throw new Error("expected the header text");
    expect(header.content.length).toBeLessThan(600);
    expect(header.content).toContain("…");
  });
});
