import { describe, it, expect } from "vitest";
import { ComponentType, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { componentsDataSchema } from "@createrington/shared/api/embed";
import {
  actionRow,
  buildComponentsMessage,
  buildComponentsV2,
  container,
  linkButton,
  mediaGallery,
  section,
  separator,
  text,
  thumbnail,
  validateComponentsV2,
} from "@/discord/components";

const sampleTree = componentsDataSchema.parse({
  components: [
    {
      type: "container",
      accentColor: 0x5865f2,
      components: [
        { type: "text", content: "Hello world" },
        { type: "separator", spacing: 2 },
        {
          type: "section",
          components: [{ type: "text", content: "Section body" }],
          accessory: {
            type: "thumbnail",
            url: "https://example.com/thumb.png",
          },
        },
        {
          type: "media_gallery",
          items: [{ url: "https://example.com/image.png" }],
        },
        {
          type: "action_row",
          components: [
            { type: "button", label: "Open", url: "https://example.com" },
          ],
        },
      ],
    },
    { type: "text", content: "Top level text" },
  ],
});

describe("buildComponentsV2", () => {
  it("maps each top-level node to the matching discord.js component type", () => {
    const json = buildComponentsV2(sampleTree).map((c) => c.toJSON());

    expect(json[0].type).toBe(ComponentType.Container);
    expect(json[1].type).toBe(ComponentType.TextDisplay);
  });

  it("sets the container accent color and nests its children in order", () => {
    const [container] = buildComponentsV2(sampleTree).map((c) => c.toJSON());
    if (container.type !== ComponentType.Container) {
      throw new Error("expected a container");
    }

    expect(container.accent_color).toBe(0x5865f2);
    expect(container.components.map((c) => c.type)).toEqual([
      ComponentType.TextDisplay,
      ComponentType.Separator,
      ComponentType.Section,
      ComponentType.MediaGallery,
      ComponentType.ActionRow,
    ]);
  });

  it("maps separator spacing to the discord.js enum", () => {
    const [container] = buildComponentsV2(sampleTree).map((c) => c.toJSON());
    if (container.type !== ComponentType.Container) {
      throw new Error("expected a container");
    }
    const separator = container.components.find(
      (c) => c.type === ComponentType.Separator,
    );
    expect(separator).toMatchObject({ spacing: SeparatorSpacingSize.Large });
  });

  it("builds a section with a thumbnail accessory", () => {
    const [container] = buildComponentsV2(sampleTree).map((c) => c.toJSON());
    if (container.type !== ComponentType.Container) {
      throw new Error("expected a container");
    }
    const section = container.components.find(
      (c) => c.type === ComponentType.Section,
    );
    expect(section).toMatchObject({
      accessory: {
        type: ComponentType.Thumbnail,
        media: { url: "https://example.com/thumb.png" },
      },
    });
  });
});

describe("validateComponentsV2", () => {
  it("accepts a well-formed tree", () => {
    expect(validateComponentsV2(sampleTree)).toBeNull();
  });

  it("rejects more than 40 total components", () => {
    const tree = componentsDataSchema.parse({
      components: [
        {
          type: "container",
          components: Array.from({ length: 40 }, () => ({
            type: "separator" as const,
          })),
        },
      ],
    });
    expect(validateComponentsV2(tree)).toMatch(/Too many components/);
  });

  it("rejects more than 4000 total text characters", () => {
    const tree = componentsDataSchema.parse({
      components: [
        { type: "text", content: "a".repeat(2500) },
        { type: "text", content: "b".repeat(2500) },
      ],
    });
    expect(validateComponentsV2(tree)).toMatch(/Too much text/);
  });
});

describe("node constructors", () => {
  it("apply schema defaults so the tree parses without extra fields", () => {
    const tree = {
      components: [
        container(
          [
            text("Body"),
            separator(),
            section(
              ["Section body"],
              thumbnail("https://example.com/thumb.png"),
            ),
            mediaGallery([{ url: "https://example.com/image.png" }]),
            actionRow([linkButton("Open", "https://example.com", "🔗")]),
          ],
          { accentColor: 0x5865f2 },
        ),
      ],
    };

    expect(() => componentsDataSchema.parse(tree)).not.toThrow();
  });

  it("set separator defaults to a small divider", () => {
    expect(separator()).toEqual({
      type: "separator",
      divider: true,
      spacing: 1,
    });
  });

  it("omit the button emoji when none is given", () => {
    expect(linkButton("Open", "https://example.com")).toEqual({
      type: "button",
      label: "Open",
      url: "https://example.com",
    });
  });

  it("accept raw strings or text nodes as section bodies", () => {
    const built = section(["a", text("b")], {
      type: "button",
      label: "Go",
      url: "https://example.com",
    });
    expect(built.components).toEqual([
      { type: "text", content: "a" },
      { type: "text", content: "b" },
    ]);
  });

  it("default thumbnail spoiler to false", () => {
    expect(thumbnail("https://example.com/t.png")).toMatchObject({
      type: "thumbnail",
      url: "https://example.com/t.png",
      spoiler: false,
    });
  });
});

describe("buildComponentsMessage", () => {
  it("returns top-level builders and the Components V2 flag", () => {
    const result = buildComponentsMessage({
      components: [container([text("Hello")], { accentColor: 0x5865f2 })],
    });

    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].toJSON().type).toBe(ComponentType.Container);
  });

  it("throws when the tree exceeds the aggregate limits", () => {
    expect(() =>
      buildComponentsMessage({
        components: [
          { type: "text", content: "a".repeat(2500) },
          { type: "text", content: "b".repeat(2500) },
        ],
      }),
    ).toThrow(/Too much text/);
  });
});
