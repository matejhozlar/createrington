import portalUrl from "@/assets/parallel-worlds/pw-portal.png";
import type { PortalKind } from "./levels";
import { context2d, createCanvas, loadImage } from "./skin";
import type { Sprite } from "./sprites";
import { hash } from "./util";

export type PortalFrames = Record<PortalKind, Sprite[]>;

export const PORTAL_TILE = 16;
export const PORTAL_FRAME_DURATION = 0.085;
const FALLBACK_FRAMES = 8;

function sliceSheet(image: HTMLImageElement): Sprite[] {
  const count = Math.max(1, Math.floor(image.height / PORTAL_TILE));
  const frames: Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = createCanvas(PORTAL_TILE, PORTAL_TILE);
    const ctx = context2d(canvas);
    ctx.drawImage(
      image,
      0,
      i * PORTAL_TILE,
      PORTAL_TILE,
      PORTAL_TILE,
      0,
      0,
      PORTAL_TILE,
      PORTAL_TILE,
    );
    frames.push(canvas);
  }
  return frames;
}

function fallbackFrames(): Sprite[] {
  const frames: Sprite[] = [];
  for (let f = 0; f < FALLBACK_FRAMES; f++) {
    const canvas = createCanvas(PORTAL_TILE, PORTAL_TILE);
    const ctx = context2d(canvas);
    for (let y = 0; y < PORTAL_TILE; y++) {
      for (let x = 0; x < PORTAL_TILE; x++) {
        const n = hash(x * 17 + y * 29 + f * 101, 31);
        ctx.fillStyle = `rgb(${Math.round(90 + n * 70)}, ${Math.round(30 + n * 40)}, ${Math.round(150 + n * 80)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    frames.push(canvas);
  }
  return frames;
}

function tintEnd(frame: Sprite): Sprite {
  const canvas = createCanvas(frame.width, frame.height);
  const ctx = context2d(canvas);
  ctx.drawImage(frame, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    data[i] = Math.round(g * 0.55);
    data[i + 1] = Math.round(b * 0.72);
    data[i + 2] = Math.round(r * 0.85);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function loadPortalFrames(): Promise<PortalFrames> {
  const nether = await loadImage(portalUrl)
    .then(sliceSheet)
    .catch(fallbackFrames);
  return { nether, end: nether.map(tintEnd) };
}
