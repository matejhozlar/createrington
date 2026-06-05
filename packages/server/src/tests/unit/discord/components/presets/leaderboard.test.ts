import { describe, it, expect } from "vitest";
import { ComponentType, MessageFlags } from "discord.js";
import { LeaderboardComponentPresets } from "@/discord/components/presets/leaderboard";
import {
  type LeaderboardConfig,
  type LeaderboardEntry,
  LeaderboardType,
} from "@/services/discord/leaderboard/types";

const at = new Date("2030-01-01T00:00:00Z");

type Accessory = { type: number; media?: { url: string }; custom_id?: string };
type ChildView = {
  type: number;
  content?: string;
  accessory?: Accessory;
  items?: Array<{ media?: { url: string } }>;
  components?: Array<{ type: number; content?: string }>;
};

function configFor(type: LeaderboardType): LeaderboardConfig {
  return {
    type,
    title: "Test Leaderboard",
    description: "desc",
    emoji: "",
    titleImageUrl: `https://assets.createrington.com/titles/${type}.png`,
    channelId: "channel-1",
    fetchData: async () => [],
    formatValue: (v: number) => String(v),
  };
}

function entries(n: number): LeaderboardEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    playerName: `Player${i + 1}`,
    playerUuid: `uuid-${i + 1}`,
    value: `${100 - i}`,
    formattedValue: `${100 - i} pts`,
    subtitle: `${i + 1} sessions`,
  }));
}

function render(type: LeaderboardType, count: number) {
  const result = LeaderboardComponentPresets.display(
    configFor(type),
    entries(count),
    at,
  );
  const [container] = result.components.map((c) => c.toJSON());
  if (container.type !== ComponentType.Container) {
    throw new Error("expected a container");
  }
  const children = container.components as ChildView[];
  const entrySections = children.filter(
    (c) =>
      c.type === ComponentType.Section &&
      c.accessory?.type === ComponentType.Thumbnail,
  );
  const footer = children.find(
    (c) =>
      c.type === ComponentType.Section &&
      c.accessory?.type === ComponentType.Button,
  );
  return { result, children, entrySections, footer };
}

describe("LeaderboardComponentPresets.display", () => {
  it("returns a single container with the Components V2 flag", () => {
    const { result } = render(LeaderboardType.PLAYTIME, 3);
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.components).toHaveLength(1);
  });

  it("leads with the title banner", () => {
    const { children } = render(LeaderboardType.PLAYTIME, 8);
    expect(children[0].type).toBe(ComponentType.MediaGallery);
    expect(children[0].items?.[0]?.media?.url).toContain("playtime.png");
  });

  it("renders one entry section per player with a separator between each", () => {
    const { children, entrySections } = render(LeaderboardType.PLAYTIME, 8);
    expect(entrySections).toHaveLength(8);
    const separators = children.filter(
      (c) => c.type === ComponentType.Separator,
    );
    // One after the banner plus one after each entry section.
    expect(separators.length).toBeGreaterThanOrEqual(8);
  });

  it("renders names and values as headings with a subtitle line", () => {
    const { entrySections } = render(LeaderboardType.PLAYTIME, 1);
    const content = entrySections[0].components?.[0]?.content ?? "";
    expect(content).toContain("## 🥇 Player1");
    expect(content).toContain("## 100 pts");
    expect(content).toContain("-# 1 sessions");
  });

  it("puts each player's head as the section thumbnail accessory", () => {
    const { entrySections } = render(LeaderboardType.PLAYTIME, 1);
    expect(entrySections[0].accessory).toMatchObject({
      type: ComponentType.Thumbnail,
      media: { url: "https://mc-heads.net/avatar/uuid-1" },
    });
  });

  it("pairs the footer timestamp with the refresh button accessory", () => {
    const { footer } = render(LeaderboardType.NET_WORTH, 1);
    const unix = Math.floor(at.getTime() / 1000);
    expect(footer?.components?.[0]?.content).toContain(`<t:${unix}:R>`);
    expect(footer?.accessory).toMatchObject({
      type: ComponentType.Button,
      custom_id: "leaderboard:refresh:net_worth",
    });
  });

  it("shows an empty-state note and no entry sections when there are no entries", () => {
    const { children, entrySections } = render(LeaderboardType.PLAYTIME, 0);
    expect(entrySections).toHaveLength(0);
    const texts = children.filter((c) => c.type === ComponentType.TextDisplay);
    expect(texts.some((t) => t.content?.includes("No players"))).toBe(true);
  });
});
