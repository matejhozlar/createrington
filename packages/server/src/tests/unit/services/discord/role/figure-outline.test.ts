import { describe, it, expect } from "vitest";
import {
  opaqueBox,
  outlineOffset,
  type RgbaImage,
} from "@/services/discord/role/figure-outline";

function image(
  width: number,
  height: number,
  box?: { x: number; y: number; width: number; height: number },
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  if (box) {
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        data[(y * width + x) * 4 + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

describe("opaqueBox", () => {
  it("bounds every pixel that is not fully transparent", () => {
    expect(
      opaqueBox(image(20, 30, { x: 3, y: 7, width: 5, height: 9 })),
    ).toEqual({ x: 3, y: 7, width: 5, height: 9 });
  });

  it("returns null for a fully transparent image", () => {
    expect(opaqueBox(image(4, 4))).toBeNull();
  });
});

describe("outlineOffset", () => {
  it("places the plain figure centred inside the evenly grown outline", () => {
    const plain = image(581, 872, { x: 2, y: 43, width: 578, height: 828 });
    const outlined = image(615, 923, { x: 2, y: 60, width: 612, height: 862 });

    expect(outlineOffset(plain, outlined)).toEqual({ x: 17, y: 34 });
  });

  it("rejects an outline that is not an even border", () => {
    const plain = image(10, 16, { x: 2, y: 4, width: 6, height: 10 });
    const outlined = image(14, 20, { x: 0, y: 0, width: 13, height: 20 });

    expect(outlineOffset(plain, outlined)).toBeNull();
  });

  it("rejects an outline that would push the plain canvas out of frame", () => {
    const plain = image(10, 16, { x: 0, y: 0, width: 6, height: 10 });
    const outlined = image(12, 16, { x: 8, y: 4, width: 4, height: 12 });

    expect(outlineOffset(plain, outlined)).toBeNull();
  });

  it("returns null when either render is empty", () => {
    expect(outlineOffset(image(4, 4), image(6, 6))).toBeNull();
  });
});
