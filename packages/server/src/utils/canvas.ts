import { createCanvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";

export interface BBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export function computeBBox(img: Image): BBox | null {
  const probe = createCanvas(img.width, img.height);
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const { data } = pctx.getImageData(0, 0, img.width, img.height);
  let minX = img.width;
  let minY = img.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function fitFontSize(
  ctx: SKRSContext2D,
  text: string,
  font: (size: number) => string,
  sizes: readonly number[],
  maxWidth: number,
): number {
  for (const size of sizes) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}
