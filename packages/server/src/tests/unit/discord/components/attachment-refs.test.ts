import { describe, it, expect } from "vitest";
import {
  componentsDataSchema,
  findAttachmentRef,
  messagePayloadSchema,
} from "@createrington/shared/api/embed";

function treeWithThumbnail(url: string) {
  return {
    components: [
      {
        type: "section",
        components: [{ type: "text", content: "Ranked up" }],
        accessory: { type: "thumbnail", url },
      },
    ],
  };
}

function treeWithGallery(url: string) {
  return {
    components: [
      {
        type: "container",
        components: [{ type: "media_gallery", items: [{ url }] }],
      },
    ],
  };
}

describe("attachment references in Components V2 media", () => {
  it("accepts a plain attachment filename", () => {
    expect(
      componentsDataSchema.safeParse(
        treeWithThumbnail("attachment://rank-up.png"),
      ).success,
    ).toBe(true);
    expect(
      componentsDataSchema.safeParse(treeWithGallery("attachment://shot.webp"))
        .success,
    ).toBe(true);
  });

  it.each([
    ["an unsupported extension", "attachment://rank-up.svg"],
    ["no extension at all", "attachment://rank-up"],
    [
      "an uppercase scheme Discord will not resolve",
      "ATTACHMENT://rank-up.png",
    ],
    ["a path segment", "attachment://../rank-up.png"],
    ["a bare scheme", "attachment://"],
    ["a non-http scheme", "javascript:alert(1)"],
  ])("rejects %s", (_label, url) => {
    expect(componentsDataSchema.safeParse(treeWithThumbnail(url)).success).toBe(
      false,
    );
  });

  it("finds the reference wherever it sits in the tree", () => {
    const thumbnail = componentsDataSchema.parse(
      treeWithThumbnail("attachment://rank-up.png"),
    );
    const gallery = componentsDataSchema.parse(
      treeWithGallery("attachment://shot.webp"),
    );

    expect(findAttachmentRef(thumbnail.components)).toBe(
      "attachment://rank-up.png",
    );
    expect(findAttachmentRef(gallery.components)).toBe(
      "attachment://shot.webp",
    );
    expect(
      findAttachmentRef(
        componentsDataSchema.parse(treeWithThumbnail("https://cdn.test/a.png"))
          .components,
      ),
    ).toBeNull();
  });

  it("keeps attachment references out of builder-authored messages", () => {
    expect(
      messagePayloadSchema.safeParse({
        kind: "components",
        components: treeWithThumbnail("attachment://rank-up.png"),
      }).success,
    ).toBe(false);

    expect(
      messagePayloadSchema.safeParse({
        kind: "components",
        components: treeWithThumbnail("https://cdn.test/a.png"),
      }).success,
    ).toBe(true);
  });
});
