import { describe, expect, it } from "vitest";
import type { EmbedData } from "@createrington/shared/api/embed";
import {
  DEFAULT_EMBED,
  normalizeLoadedEmbed,
  toExternalData,
} from "@/features/admin/tools/embed-builder/embed-data";

describe("normalizeLoadedEmbed", () => {
  it("fills every key the builder expects from a partial embed", () => {
    const loaded = normalizeLoadedEmbed({ title: "Rules" });

    expect(loaded).toEqual({ ...DEFAULT_EMBED, title: "Rules" });
  });

  it("gives each field its own id", () => {
    const loaded = normalizeLoadedEmbed({
      fields: [
        { name: "A", value: "1", inline: false },
        { name: "B", value: "2", inline: true },
      ],
    });

    expect(
      loaded.fields.map(({ name, value, inline }) => [name, value, inline]),
    ).toEqual([
      ["A", "1", false],
      ["B", "2", true],
    ]);
    expect(new Set(loaded.fields.map((field) => field._id)).size).toBe(2);
  });

  it("flattens the Discord-style footer and author objects", () => {
    const discordShaped = {
      footer: { text: "Createrington" },
      author: {
        name: "matej",
        url: "https://createrington.com",
        icon_url: "https://createrington.com/icon.png",
      },
    } as unknown as Partial<EmbedData>;

    expect(normalizeLoadedEmbed(discordShaped)).toMatchObject({
      footer: "Createrington",
      author: "matej",
      authorUrl: "https://createrington.com",
      authorIconUrl: "https://createrington.com/icon.png",
    });
  });

  it("keeps the flat author url when the author object has none", () => {
    const loaded = normalizeLoadedEmbed({
      author: { name: "matej" },
      authorUrl: "https://createrington.com",
    } as unknown as Partial<EmbedData>);

    expect(loaded.author).toBe("matej");
    expect(loaded.authorUrl).toBe("https://createrington.com");
  });
});

describe("toExternalData", () => {
  it("drops the internal field ids and keeps everything else", () => {
    const internal = normalizeLoadedEmbed({
      title: "Rules",
      fields: [{ name: "A", value: "1", inline: false }],
    });

    expect(toExternalData(internal)).toEqual({
      ...DEFAULT_EMBED,
      title: "Rules",
      fields: [{ name: "A", value: "1", inline: false }],
    });
  });
});
