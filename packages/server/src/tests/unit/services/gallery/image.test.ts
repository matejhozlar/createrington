import { describe, it, expect } from "vitest";
import { detectImageType } from "@/services/gallery/image";
import { isImageAttachment, type IntakeAttachment } from "@/services/gallery";
import { GALLERY_MAX_ORIGINAL_BYTES } from "@createrington/shared/gallery";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(16),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
  Buffer.alloc(8),
]);

function attachment(
  overrides: Partial<IntakeAttachment> = {},
): IntakeAttachment {
  return {
    id: "1",
    name: "shot.png",
    url: "https://cdn.example/shot.png",
    size: 1024,
    contentType: "image/png",
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

describe("detectImageType", () => {
  it("recognises png, jpeg and webp signatures", () => {
    expect(detectImageType(PNG)).toEqual({
      contentType: "image/png",
      extension: "png",
    });
    expect(detectImageType(JPEG)).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(detectImageType(WEBP)).toEqual({
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("returns null for anything else", () => {
    expect(detectImageType(Buffer.from("not an image at all"))).toBeNull();
    expect(detectImageType(Buffer.from("RIFF1234WAVE"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(PNG.subarray(0, 4))).toBeNull();
  });
});

describe("isImageAttachment", () => {
  it("accepts the supported image content types, ignoring parameters and case", () => {
    expect(isImageAttachment(attachment())).toBe(true);
    expect(isImageAttachment(attachment({ contentType: "image/jpeg" }))).toBe(
      true,
    );
    expect(
      isImageAttachment(attachment({ contentType: "IMAGE/WEBP; charset=x" })),
    ).toBe(true);
  });

  it("rejects other content types and missing types", () => {
    expect(isImageAttachment(attachment({ contentType: "image/gif" }))).toBe(
      false,
    );
    expect(isImageAttachment(attachment({ contentType: "video/mp4" }))).toBe(
      false,
    );
    expect(isImageAttachment(attachment({ contentType: null }))).toBe(false);
  });

  it("rejects attachments over the size cap", () => {
    expect(
      isImageAttachment(attachment({ size: GALLERY_MAX_ORIGINAL_BYTES })),
    ).toBe(true);
    expect(
      isImageAttachment(attachment({ size: GALLERY_MAX_ORIGINAL_BYTES + 1 })),
    ).toBe(false);
  });
});
