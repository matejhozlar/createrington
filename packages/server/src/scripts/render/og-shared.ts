// Shared plumbing for the og card renderers: brand tokens, asset paths, font
// registration, and the supersampled render-to-png pipeline.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCanvas,
  GlobalFonts,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";

export const W = 1200;
export const H = 630;
// Render at 2x then downscale so gradients, screenshot edges, and text stay
// crisp.
const SUPERSAMPLE = 2;

// Brand tokens (client theme.css OkLCH values converted to sRGB).
export const BG_TOP = "#17171d";
export const BG_BOT = "#0b0b0e";
export const CARD = "#18181d";
export const AMBER = "#ffb900";
export const FOREGROUND = "#fafafb";
export const MUTED = "#a0a0a5";

export const TEXT_X = 74;

const here = dirname(fileURLToPath(import.meta.url));
export const PUBLIC = join(here, "..", "..", "..", "..", "client", "public");
export const ASSETS = join(PUBLIC, "assets");
const FONTS = join(here, "..", "..", "assets", "fonts");

export function registerBrandFonts(): void {
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-400.woff2"), "Outfit");
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-500.woff2"), "Outfit");
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-600.woff2"), "Outfit");
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-700.woff2"), "Outfit");
}

export function roundRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// object-fit: cover, clipped by the current path. "top-left" anchors the
// source's top-left corner (sidebar and primary content stay visible),
// "center" centers the overflow.
export function drawImageCover(
  ctx: SKRSContext2D,
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  anchor: "top-left" | "center" = "top-left",
): void {
  const scale = Math.max(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  if (anchor === "center") {
    ctx.drawImage(img, x - (drawW - w) / 2, y - (drawH - h) / 2, drawW, drawH);
  } else {
    ctx.drawImage(img, x, y, drawW, drawH);
  }
}

export async function writeCard(
  outPath: string,
  paint: (ctx: SKRSContext2D) => Promise<void>,
): Promise<void> {
  const canvas = createCanvas(W * SUPERSAMPLE, H * SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

  await paint(ctx);

  const out = createCanvas(W, H);
  out.getContext("2d").drawImage(canvas, 0, 0, W, H);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out.toBuffer("image/png"));
  console.log(`wrote ${outPath} (${W}x${H})`);
}
