// Shared plumbing for the og card renderers: brand tokens, asset paths, font
// registration, and the supersampled render-to-png pipeline.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCanvas,
  loadImage,
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

const WORDMARK_W = 330;

export async function paintWordmark(
  ctx: SKRSContext2D,
  x = TEXT_X,
  y = 54,
): Promise<void> {
  const img = await loadImage(join(ASSETS, "createrington-wordmark.png"));
  ctx.drawImage(img, x, y, WORDMARK_W, (WORDMARK_W * img.height) / img.width);
}

export interface PoseFigureRequest {
  uuid: string;
  pose: string;
  file: string;
  width: number;
  height: number;
}

// Resolve a posed figure PNG: prefer the committed cache, otherwise render it
// via the skin-api and cache it so later card renders stay offline. Calls the
// HTTP endpoint directly rather than via the SDK because the SDK does not
// forward the `outline` option, which gives the figures the white edge that
// reads against the dark card.
export async function getPoseFigure(req: PoseFigureRequest): Promise<Image> {
  if (!existsSync(req.file)) {
    const apiKey = process.env.SKIN_API_KEY;
    if (!apiKey) {
      throw new Error(
        `Missing cached figure (${req.file}) and SKIN_API_KEY is not set. ` +
          `Run once with the skin-api key in the environment to populate ` +
          `the cache, e.g.: infisical run --env=dev -- pnpm --filter ` +
          `@createrington/server util:render-og-card`,
      );
    }
    // Defaults to the public skin-api so the script runs without env setup;
    // dev/infisical runs override via SKIN_API_URL.
    const baseUrl = process.env.SKIN_API_URL ?? "https://api.createrington.com";
    const query = new URLSearchParams({
      pose: req.pose,
      width: String(req.width),
      height: String(req.height),
      outline: "true",
    });
    const res = await fetch(`${baseUrl}/v1/render?${query}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "createrington-app/og-card",
      },
      body: JSON.stringify({ uuid: req.uuid }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `skin-api render failed for ${req.uuid}/${req.pose} (${res.status}): ${detail}`,
      );
    }
    const png = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(req.file), { recursive: true });
    await writeFile(req.file, png);
  }
  return loadImage(await readFile(req.file));
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
