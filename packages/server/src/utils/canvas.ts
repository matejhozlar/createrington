import { createCanvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";

export interface BBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export function computeBBox(img: Image): BBox | null {
  // width/height are native getters, so reading them per iteration dominates
  // the scan: hoisting them (and walking the alpha byte with a running index)
  // takes a 895x1343 figure from ~156ms to ~5ms.
  const width = img.width;
  const height = img.height;
  const probe = createCanvas(width, height);
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const { data } = pctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0, alpha = 3; y < height; y++) {
    for (let x = 0; x < width; x++, alpha += 4) {
      if (data[alpha] > 16) {
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
