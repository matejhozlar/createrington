import { describe, it, expect } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { squarePoseThumbnail } from "@/discord/utils/pose-thumbnail";
import { computeBBox } from "@/utils/canvas";

function poseRender(
  figure: { x: number; y: number; width: number; height: number } | null,
): Uint8Array {
  const canvas = createCanvas(400, 600);
  if (figure) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(figure.x, figure.y, figure.width, figure.height);
  }
  return canvas.toBuffer("image/png");
}

describe("squarePoseThumbnail", () => {
  it("returns a square canvas so Discord's thumbnail crop is a no-op", async () => {
    const squared = await squarePoseThumbnail(
      poseRender({ x: 150, y: 20, width: 100, height: 560 }),
    );
    const image = await loadImage(squared);

    expect(image.width).toBe(image.height);
  });

  it("fits the whole figure inside the square", async () => {
    const squared = await squarePoseThumbnail(
      poseRender({ x: 150, y: 20, width: 100, height: 560 }),
    );
    const bbox = computeBBox(await loadImage(squared));

    expect(bbox).not.toBeNull();
    if (!bbox) return;
    expect(bbox.minX).toBeGreaterThan(0);
    expect(bbox.minY).toBeGreaterThan(0);
    expect(bbox.minX + bbox.width).toBeLessThan(768);
    expect(bbox.minY + bbox.height).toBeLessThan(768);
  });

  it("scales a figure that only fills part of its canvas up to the frame", async () => {
    const squared = await squarePoseThumbnail(
      poseRender({ x: 40, y: 300, width: 320, height: 240 }),
    );
    const bbox = computeBBox(await loadImage(squared));

    expect(bbox?.width).toBe(720);
  });

  it("rejects a fully transparent render so the caller can fall back", async () => {
    await expect(squarePoseThumbnail(poseRender(null))).rejects.toThrow(
      /fully transparent/,
    );
  });
});
