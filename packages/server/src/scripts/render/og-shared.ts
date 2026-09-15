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
import { computeBBox } from "@/utils/canvas";

// Deep import on purpose: the @/services/skin-api barrel pulls in @/config,
// whose env validation these standalone scripts cannot satisfy.
import { MAX_QUALITY_RENDER } from "@/services/skin-api/quality";

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
const PUBLIC = join(here, "..", "..", "..", "..", "client", "public");
export const ASSETS = join(PUBLIC, "assets");
const FONTS = join(here, "..", "..", "assets", "fonts");
// One cache for every card's posed figures, keyed by username and pose.
const FIGURES = join(here, "assets", "figures");

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

// Radial gradient stretched to an ellipse and painted over the whole card:
// ground shadows, vignettes, and glow pools.
export function paintEllipseGradient(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stops: readonly (readonly [number, string])[],
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(-cx / rx, -cy / ry, W / rx, H / ry);
  ctx.restore();
}

// Greedy word wrap against the measured width of `font`. Leaves ctx.font set
// to `font`.
export function wrapText(
  ctx: SKRSContext2D,
  text: string,
  font: string,
  maxWidth: number,
): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
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
  /**
   * Cache key together with `pose`, not just a label: renaming this rebinds
   * or orphans a cache entry. `uuid` is deliberately not part of the key, so
   * changing it is not detected either; delete the cached file to re-render.
   */
  username: string;
}

// Resolve a posed figure PNG: prefer the committed cache, otherwise render it
// via the skin-api and cache it so later card renders stay offline. Every card
// shares one cache directory keyed by username and pose, so the same figure
// requested by two cards is stored (and refreshed) once. A re-render needs the
// cached file deleted first; nothing here detects a changed skin or a changed
// render size. Calls the HTTP endpoint directly rather than via the SDK
// because the SDK does not forward the `outline` option, which gives the
// figures the white edge that reads against the dark card.
export async function getPoseFigure(req: PoseFigureRequest): Promise<Image> {
  const file = join(FIGURES, `${req.username}-${req.pose}.png`);
  if (!existsSync(file)) {
    const { width, height } = MAX_QUALITY_RENDER;
    const apiKey = process.env.SKIN_API_KEY;
    if (!apiKey) {
      throw new Error(
        `Missing cached figure (${file}) and SKIN_API_KEY is not set. ` +
          `Re-run this card's util:render-og-* script once with the ` +
          `skin-api key in the environment to populate the cache, e.g. ` +
          `via infisical run --env=dev`,
      );
    }
    // Defaults to the public skin-api so the script runs without env setup;
    // dev/infisical runs override via SKIN_API_URL.
    const baseUrl = process.env.SKIN_API_URL ?? "https://api.createrington.com";
    const query = new URLSearchParams({
      pose: req.pose,
      width: String(width),
      height: String(height),
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
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, png);
  }
  return loadImage(await readFile(file));
}

export interface PosedFigureSpec extends PoseFigureRequest {
  /** Painted height in card pixels; the cached render is scaled to match. */
  height: number;
  centerX: number;
  groundY: number;
  /** Flip horizontally, e.g. so a pointing arm aims into the scene. */
  mirror?: boolean;
}

export interface PosedFigureStyle {
  /** Rim glow drawn as a shadow pass behind the figure. */
  glow: string;
  glowBlur: number;
  /** Ground shadow ellipse, as a fraction of the figure width and in pixels. */
  shadowScale: number;
  shadowRy: number;
  shadowAlpha: number;
}

// Paints one posed figure standing on `groundY`: soft ground shadow, a
// blurred glow pass, then the figure itself, trimmed to its bounding box so
// the transparent margin of the skin render does not offset it.
export async function paintPosedFigure(
  ctx: SKRSContext2D,
  spec: PosedFigureSpec,
  style: PosedFigureStyle,
): Promise<void> {
  const img = await getPoseFigure(spec);
  const bbox = computeBBox(img);
  if (!bbox) throw new Error(`Empty figure render for ${spec.username}`);

  const scale = spec.height / bbox.height;
  const w = bbox.width * scale;
  const x = spec.centerX - w / 2;
  const y = spec.groundY - spec.height;

  paintEllipseGradient(
    ctx,
    spec.centerX,
    spec.groundY - 3,
    w * style.shadowScale,
    style.shadowRy,
    [
      [0, `rgba(0,0,0,${style.shadowAlpha})`],
      [1, "rgba(0,0,0,0)"],
    ],
  );

  ctx.save();
  if (spec.mirror) {
    ctx.translate(spec.centerX * 2, 0);
    ctx.scale(-1, 1);
  }

  ctx.save();
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = style.glowBlur;
  ctx.drawImage(
    img,
    bbox.minX,
    bbox.minY,
    bbox.width,
    bbox.height,
    x,
    y,
    w,
    spec.height,
  );
  ctx.restore();

  ctx.drawImage(
    img,
    bbox.minX,
    bbox.minY,
    bbox.width,
    bbox.height,
    x,
    y,
    w,
    spec.height,
  );
  ctx.restore();
}

export async function writeCard(
  outPath: string,
  paint: (ctx: SKRSContext2D) => Promise<void>,
): Promise<void> {
  const canvas = createCanvas(W * SUPERSAMPLE, H * SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  // Every resample the card paints (screenshots, backdrops, skin figures)
  // wants the good filter; napi-rs defaults to "low". Painters that want
  // nearest-neighbour pixel art set imageSmoothingEnabled = false, which makes
  // this inert for them.
  ctx.imageSmoothingQuality = "high";

  await paint(ctx);

  const out = createCanvas(W, H);
  const outCtx = out.getContext("2d");
  // This is the supersample downsample, so it is the resampling step that
  // decides the card's final sharpness. napi-rs defaults to "low".
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(canvas, 0, 0, W, H);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out.toBuffer("image/png"));
  console.log(`wrote ${outPath} (${W}x${H})`);
}
