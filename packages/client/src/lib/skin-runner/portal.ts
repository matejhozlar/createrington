import portalUrl from "@/assets/parallel-worlds/pw-portal.png";
import { context2d, createCanvas } from "@/lib/canvas";
import { loadImage } from "@/lib/image";
import type { PortalKind } from "./levels";
import { PORTAL_BLOCK, type Sprite, type Sprites } from "./sprites";
import { hash, rand, rgba, type Rgb } from "./util";
import { blit, screenX, screenY, type View } from "./view";

export type PortalFrames = Record<PortalKind, Sprite[]>;

export type Portal = {
  kind: PortalKind;
  x: number;
  color: Rgb;
  entered: boolean;
};

const PORTAL_TILE = 16;
const PORTAL_FRAME_DURATION = 0.085;
const FALLBACK_FRAMES = 8;

const PORTAL_COLS = 4;
const PORTAL_ROWS = 5;
const INTERIOR_COLS = 2;
const INTERIOR_ROWS = 3;
const PORTAL_SINK = PORTAL_BLOCK;
export const PORTAL_W = PORTAL_COLS * PORTAL_BLOCK;
const PORTAL_H = PORTAL_ROWS * PORTAL_BLOCK;
const INTERIOR_W = INTERIOR_COLS * PORTAL_BLOCK;
const INTERIOR_H = INTERIOR_ROWS * PORTAL_BLOCK;
const GLOW_INNER = 4;
const GLOW_REACH = 0.7;
const GLOW_ALPHA = 0.35;
const FALLBACK_ALPHA = 0.8;
const VEIL_ALPHA = 0.5;
const VIGNETTE_ALPHA = 0.9;
const VIGNETTE_INNER = 0.2;
const VIGNETTE_REACH = 0.7;

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

export function interiorPoint(portal: Portal): { x: number; y: number } {
  return {
    x: portal.x + PORTAL_BLOCK + rand(0, INTERIOR_W),
    y: rand(0, INTERIOR_H),
  };
}

function frameBlock(kind: PortalKind, row: number, sprites: Sprites): Sprite {
  if (kind === "nether") return sprites.obsidian;
  return row === 0 ? sprites.endFrameEye : sprites.endFrame;
}

function isInterior(row: number, col: number): boolean {
  return row >= 1 && row <= INTERIOR_ROWS && col >= 1 && col <= INTERIOR_COLS;
}

export function drawPortal(
  view: View,
  portal: Portal,
  frames: PortalFrames | null,
  sprites: Sprites,
): void {
  const { ctx, texel } = view;
  const x = screenX(view, portal.x);
  const topY = screenY(view, PORTAL_H - PORTAL_SINK);
  const interiorX = x + PORTAL_BLOCK * texel;
  const interiorY = screenY(view, INTERIOR_H);
  const interiorW = INTERIOR_W * texel;
  const interiorH = INTERIOR_H * texel;
  const tileCols = Math.ceil(INTERIOR_W / PORTAL_TILE);
  const tileRows = Math.ceil(INTERIOR_H / PORTAL_TILE);
  const cx = interiorX + interiorW / 2;
  const cy = interiorY + interiorH / 2;
  const radius = PORTAL_H * GLOW_REACH * texel;

  const glow = ctx.createRadialGradient(
    cx,
    cy,
    GLOW_INNER * texel,
    cx,
    cy,
    radius,
  );
  glow.addColorStop(0, rgba(portal.color, GLOW_ALPHA));
  glow.addColorStop(1, rgba(portal.color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  const cycle = frames?.[portal.kind];
  if (cycle && cycle.length > 0) {
    const position = (view.time / PORTAL_FRAME_DURATION) % cycle.length;
    const current = Math.floor(position);
    const next = (current + 1) % cycle.length;
    const layers: [Sprite | undefined, number][] = [
      [cycle[current], 1],
      [cycle[next], position - current],
    ];
    ctx.save();
    ctx.beginPath();
    ctx.rect(interiorX, interiorY, interiorW, interiorH);
    ctx.clip();
    for (const [frame, alpha] of layers) {
      if (!frame) continue;
      ctx.globalAlpha = alpha;
      for (let ty = 0; ty < tileRows; ty++) {
        for (let tx = 0; tx < tileCols; tx++) {
          ctx.drawImage(
            frame,
            interiorX + tx * PORTAL_TILE * texel,
            interiorY + ty * PORTAL_TILE * texel,
            PORTAL_TILE * texel,
            PORTAL_TILE * texel,
          );
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    ctx.fillStyle = rgba(portal.color, FALLBACK_ALPHA);
    ctx.fillRect(interiorX, interiorY, interiorW, interiorH);
  }

  for (let r = 0; r < PORTAL_ROWS; r++) {
    for (let c = 0; c < PORTAL_COLS; c++) {
      if (isInterior(r, c)) continue;
      blit(
        view,
        frameBlock(portal.kind, r, sprites),
        x + c * PORTAL_BLOCK * texel,
        topY + r * PORTAL_BLOCK * texel,
      );
    }
  }
}

export function drawVeil(view: View, color: Rgb, strength: number): void {
  const { ctx, W, H } = view;
  ctx.fillStyle = rgba(color, strength * VEIL_ALPHA);
  ctx.fillRect(0, 0, W, H);
  const vignette = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * VIGNETTE_INNER,
    W / 2,
    H / 2,
    Math.max(W, H) * VIGNETTE_REACH,
  );
  vignette.addColorStop(0, rgba(color, 0));
  vignette.addColorStop(1, rgba(color, strength * VIGNETTE_ALPHA));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}
