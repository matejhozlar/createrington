import { createCanvas, loadImage } from "@napi-rs/canvas";
import { computeBBox } from "@/utils/canvas";

const SIZE = 768;
const INSET = 24;

export async function squarePoseThumbnail(png: Uint8Array): Promise<Buffer> {
  const image = await loadImage(Buffer.from(png));
  const bbox = computeBBox(image);
  if (!bbox) throw new Error("Pose render is fully transparent");

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  const box = SIZE - INSET * 2;
  const scale = Math.min(box / bbox.width, box / bbox.height);
  const width = bbox.width * scale;
  const height = bbox.height * scale;

  ctx.drawImage(
    image,
    bbox.minX,
    bbox.minY,
    bbox.width,
    bbox.height,
    (SIZE - width) / 2,
    (SIZE - height) / 2,
    width,
    height,
  );

  return canvas.toBuffer("image/png");
}
