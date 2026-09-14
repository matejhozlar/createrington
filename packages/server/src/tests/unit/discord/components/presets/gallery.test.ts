import { describe, it, expect } from "vitest";
import { ButtonStyle, ComponentType } from "discord.js";
import {
  GalleryComponentPresets,
  type GalleryApprovalAnnouncementInput,
} from "@/discord/components/presets/gallery";
import {
  buildComponentsMessage,
  validateComponentsV2,
} from "@/discord/components";
import { ComponentColors } from "@/discord/components/colors";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

type Child = ComponentContainer["components"][number];
type JsonNode = {
  type: number;
  style?: number;
  custom_id?: string;
  url?: string;
  components?: JsonNode[];
};

const GALLERY_URL = "https://createrington.test/gallery";

function input(
  overrides: Partial<GalleryApprovalAnnouncementInput> = {},
): GalleryApprovalAnnouncementInput {
  return {
    authorDiscordId: "123",
    caption: "Central station",
    creditNames: [],
    rewardAmount: 50,
    imageUrl: "https://cdn.test/shot.webp",
    galleryUrl: GALLERY_URL,
    ...overrides,
  };
}

function root(message: ComponentsData): ComponentContainer {
  const [node] = message.components;
  if (node.type !== "container") throw new Error("expected a container");
  return node;
}

function body(message: ComponentsData): string {
  return root(message)
    .components.filter(
      (node): node is Extract<Child, { type: "text" }> => node.type === "text",
    )
    .map((node) => node.content)
    .join("\n");
}

function buttons(nodes: JsonNode[]): JsonNode[] {
  return nodes.flatMap((node) =>
    node.type === ComponentType.Button
      ? [node]
      : buttons(node.components ?? []),
  );
}

describe("GalleryComponentPresets.approvalAnnouncement", () => {
  it("is a valid green container that opens with the published image", () => {
    const message = GalleryComponentPresets.approvalAnnouncement(input());
    const [image] = root(message).components;

    expect(validateComponentsV2(message)).toBeNull();
    expect(root(message).accentColor).toBe(ComponentColors.Success);
    expect(image).toMatchObject({
      type: "media_gallery",
      items: [
        { url: "https://cdn.test/shot.webp", description: "Central station" },
      ],
    });
    expect(body(message)).toContain("Screenshot by <@123>");
  });

  it("links to the website gallery as its only button", () => {
    const { components } = buildComponentsMessage(
      GalleryComponentPresets.approvalAnnouncement(input()),
    );
    const found = buttons(components.map((c) => c.toJSON() as JsonNode));

    expect(found).toEqual([
      expect.objectContaining({ style: ButtonStyle.Link, url: GALLERY_URL }),
    ]);
  });

  it("lists credits and the reward only when there are any", () => {
    const full = body(
      GalleryComponentPresets.approvalAnnouncement(
        input({ creditNames: ["Steve_01", "Alex"], rewardAmount: 1250 }),
      ),
    );
    expect(full).toContain("Also featuring Steve\\_01, Alex");
    expect(full).toContain("Rewarded $1,250");

    const bare = GalleryComponentPresets.approvalAnnouncement(
      input({ caption: null, rewardAmount: 0 }),
    );
    expect(body(bare)).toBe("### Screenshot by <@123>");
  });
});
