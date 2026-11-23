import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMBED,
  parseComponents,
  parseEmbed,
  parsePayload,
  payloadHasContent,
} from "@/features/admin/tools/embed-builder/payload";

describe("parseEmbed", () => {
  it("fills every key the builder expects from a partial embed", () => {
    expect(parseEmbed({ title: "Rules" })).toEqual({
      ...DEFAULT_EMBED,
      title: "Rules",
    });
  });

  it("flattens the Discord-style footer, author, image and thumbnail", () => {
    expect(
      parseEmbed({
        footer: { text: "Createrington" },
        author: {
          name: "matej",
          url: "https://createrington.com",
          icon_url: "https://createrington.com/icon.png",
        },
        image: { url: "https://createrington.com/banner.png" },
        thumbnail: { url: "https://createrington.com/thumb.png" },
      }),
    ).toMatchObject({
      footer: "Createrington",
      author: "matej",
      authorUrl: "https://createrington.com",
      authorIconUrl: "https://createrington.com/icon.png",
      imageUrl: "https://createrington.com/banner.png",
      thumbnailUrl: "https://createrington.com/thumb.png",
    });
  });

  it("keeps the flat author url when the author object has none", () => {
    const loaded = parseEmbed({
      author: { name: "matej" },
      authorUrl: "https://createrington.com",
    });

    expect(loaded.author).toBe("matej");
    expect(loaded.authorUrl).toBe("https://createrington.com");
  });

  it("keeps fields that are still being filled in", () => {
    expect(
      parseEmbed({ fields: [{ name: "Rule" }, { value: "Be kind" }] }).fields,
    ).toEqual([
      { name: "Rule", value: "", inline: false },
      { name: "", value: "Be kind", inline: false },
    ]);
  });

  it("replaces values of the wrong type with the defaults", () => {
    expect(
      parseEmbed({ title: 42, color: "red", timestamp: "yes", fields: "x" }),
    ).toEqual(DEFAULT_EMBED);
  });

  it("gives an empty embed for something that is not an object", () => {
    expect(parseEmbed("not an embed")).toEqual(DEFAULT_EMBED);
  });
});

describe("parseComponents", () => {
  it("keeps a tree with parts that are still empty", () => {
    const tree = [
      { type: "text", content: "" },
      {
        type: "container",
        spoiler: false,
        components: [
          { type: "action_row", components: [{ type: "button", label: "" }] },
        ],
      },
    ];

    expect(parseComponents(tree)).toEqual([
      { type: "text", content: "" },
      {
        type: "container",
        spoiler: false,
        components: [
          {
            type: "action_row",
            components: [{ type: "button", label: "", url: "" }],
          },
        ],
      },
    ]);
  });

  it("rejects a node of an unknown type", () => {
    expect(parseComponents([{ type: "poll" }])).toBeNull();
  });

  it("rejects something that is not a list", () => {
    expect(parseComponents({ type: "text", content: "Hi" })).toBeNull();
  });
});

describe("parsePayload", () => {
  it("reads a stored components preset", () => {
    expect(
      parsePayload("components", {
        components: [{ type: "text", content: "Hi" }],
      }),
    ).toEqual({
      kind: "components",
      components: { components: [{ type: "text", content: "Hi" }] },
    });
  });

  it("rejects components data without a component list", () => {
    expect(parsePayload("components", { title: "Rules" })).toBeNull();
  });

  it("reads a stored embed preset", () => {
    expect(parsePayload("embed", { title: "Rules" })).toEqual({
      kind: "embed",
      embed: { ...DEFAULT_EMBED, title: "Rules" },
    });
  });
});

describe("payloadHasContent", () => {
  it("needs text or a field in an embed", () => {
    expect(payloadHasContent({ kind: "embed", embed: DEFAULT_EMBED })).toBe(
      false,
    );
    expect(
      payloadHasContent({
        kind: "embed",
        embed: { ...DEFAULT_EMBED, description: "Welcome" },
      }),
    ).toBe(true);
  });

  it("needs at least one component", () => {
    expect(
      payloadHasContent({ kind: "components", components: { components: [] } }),
    ).toBe(false);
    expect(
      payloadHasContent({
        kind: "components",
        components: { components: [{ type: "text", content: "Hi" }] },
      }),
    ).toBe(true);
  });
});
