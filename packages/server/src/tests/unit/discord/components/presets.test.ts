import { describe, it, expect } from "vitest";
import { componentsDataSchema } from "@createrington/shared/api/embed";
import type { ComponentsData } from "@createrington/shared/api/embed";
import { MessageFlags } from "discord.js";
import { buildComponentsMessage } from "@/discord/components";
import { ComponentColors } from "@/discord/components/colors";
import { CommonComponentPresets } from "@/discord/components/presets/common";
import { AnnouncementComponentPresets } from "@/discord/components/presets/announcements";

function topContainer(tree: ComponentsData) {
  const node = tree.components[0];
  if (!node || node.type !== "container") {
    throw new Error("expected a top-level container");
  }
  return node;
}

const commonTrees = [
  ["success", CommonComponentPresets.success("Done", "Saved")],
  ["error", CommonComponentPresets.error("Oops", "Something broke")],
  ["errorWithAdmin", CommonComponentPresets.errorWithAdmin("Oops")],
  ["info", CommonComponentPresets.info("Heads up", "Details here")],
  [
    "plain",
    CommonComponentPresets.plain({ title: "Hi", description: "there" }),
  ],
  ["loading", CommonComponentPresets.loading()],
] as const;

describe("CommonComponentPresets", () => {
  it.each(commonTrees)("%s parses and sends as a V2 message", (_name, tree) => {
    expect(() => componentsDataSchema.parse(tree)).not.toThrow();
    expect(buildComponentsMessage(tree).flags).toBe(
      MessageFlags.IsComponentsV2,
    );
  });

  it.each(commonTrees)("%s is stripeless by default", (_name, tree) => {
    expect(topContainer(tree).accentColor).toBeUndefined();
  });

  it("attaches the semantic stripe only when accent is set", () => {
    const accented = CommonComponentPresets.success("Done", undefined, {
      accent: true,
    });
    expect(topContainer(accented).accentColor).toBe(ComponentColors.Success);
  });

  it("loading uses the gray Loading stripe when accented", () => {
    const accented = CommonComponentPresets.loading("Working", {
      accent: true,
    });
    expect(topContainer(accented).accentColor).toBe(ComponentColors.Loading);
  });

  it("omits the description text node when none is provided", () => {
    expect(
      topContainer(CommonComponentPresets.success("Done")).components,
    ).toHaveLength(1);
  });

  it("plain accepts either a title or a description alone", () => {
    expect(
      topContainer(CommonComponentPresets.plain({ title: "T" })).components,
    ).toHaveLength(1);
    expect(
      topContainer(CommonComponentPresets.plain({ description: "D" }))
        .components,
    ).toHaveLength(1);
  });
});

describe("AnnouncementComponentPresets.maintenance", () => {
  const base = {
    title: "Scheduled downtime",
    description: "We are upgrading the server.",
    startsAt: new Date("2030-01-01T00:00:00Z"),
    estimatedMinutes: 30,
  };

  it("returns a valid stripeless tree", () => {
    const tree = AnnouncementComponentPresets.maintenance(base);
    expect(() => buildComponentsMessage(tree)).not.toThrow();
    expect(topContainer(tree).accentColor).toBeUndefined();
  });

  it("renders a thumbnail section when an icon url is provided", () => {
    const tree = AnnouncementComponentPresets.maintenance({
      ...base,
      iconUrl: "https://example.com/icon.png",
    });
    expect(
      topContainer(tree).components.some((c) => c.type === "section"),
    ).toBe(true);
  });

  it("adds a status button row when a status url is provided", () => {
    const tree = AnnouncementComponentPresets.maintenance({
      ...base,
      statusUrl: "https://status.example.com",
    });
    expect(
      topContainer(tree).components.some((c) => c.type === "action_row"),
    ).toBe(true);
  });

  it("adds the warning stripe when accent is set", () => {
    const tree = AnnouncementComponentPresets.maintenance({
      ...base,
      accent: true,
    });
    expect(topContainer(tree).accentColor).toBe(ComponentColors.Warning);
  });
});

describe("AnnouncementComponentPresets.spotlight", () => {
  it("returns a valid tree containing a media gallery", () => {
    const tree = AnnouncementComponentPresets.spotlight({
      title: "New feature",
      description: "Check it out.",
      imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    });
    expect(() => buildComponentsMessage(tree)).not.toThrow();
    expect(
      topContainer(tree).components.some((c) => c.type === "media_gallery"),
    ).toBe(true);
  });
});
