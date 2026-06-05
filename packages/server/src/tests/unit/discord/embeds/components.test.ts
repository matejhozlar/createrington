import { describe, it, expect } from "vitest";
import { ComponentType, SeparatorSpacingSize } from "discord.js";
import { componentsDataSchema } from "@createrington/shared/api/embed";
import {
  buildComponentsV2,
  validateComponentsV2,
} from "@/trpc/routers/admin/embeds/components";

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
