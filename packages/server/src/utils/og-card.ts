import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import { computeBBox } from "@/utils/canvas";

export const W = 1200;
export const H = 630;
const SUPERSAMPLE = 2;

export const BG_TOP = "#17171d";
export const BG_BOT = "#0b0b0e";
export const CARD = "#18181d";
export const AMBER = "#ffb900";
export const FOREGROUND = "#fafafb";
export const MUTED = "#a0a0a5";

export const TEXT_X = 74;

const SERVER_ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
);

let fontsRegistered = false;

export function registerBrandFonts(): void {
  if (fontsRegistered) return;
  for (const weight of [400, 500, 600, 700]) {
    GlobalFonts.registerFromPath(
      join(SERVER_ASSETS, "fonts", `outfit-latin-${weight}.woff2`),
      "Outfit",
    );
  }
  fontsRegistered = true;
}

export function loadServerAsset(...segments: string[]): Promise<Image> {
  return readFile(join(SERVER_ASSETS, ...segments)).then(loadImage);
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
  const img = await loadServerAsset("createrington-wordmark.png");
  ctx.drawImage(img, x, y, WORDMARK_W, (WORDMARK_W * img.height) / img.width);
}

export function paintUrlChip(
  ctx: SKRSContext2D,
  url: string,
  x: number,
  y: number,
): void {
  const chipH = 44;
  const padX = 20;
  ctx.font = "600 22px Outfit";
  const chipW = padX * 2 + ctx.measureText(url).width;

  ctx.fillStyle = "rgba(255,185,0,0.10)";
  roundRectPath(ctx, x, y, chipW, chipH, 11);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,185,0,0.40)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, chipW - 1, chipH - 1, 11);
  ctx.stroke();

  ctx.fillStyle = AMBER;
  ctx.textBaseline = "middle";
  ctx.fillText(url, x + padX, y + chipH / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

export interface FigurePlacement {
  height: number;
  centerX: number;
  groundY: number;
  maxWidth?: number;
  mirror?: boolean;
}

export interface FigureStyle {
  glow: string;
  glowBlur: number;
  shadowScale: number;
  shadowRy: number;
  shadowAlpha: number;
}

export function paintFigure(
  ctx: SKRSContext2D,
  img: Image,
  placement: FigurePlacement,
  style: FigureStyle,
): void {
  const bbox = computeBBox(img);
  if (!bbox) throw new Error("Empty figure render");

  const scale = Math.min(
    placement.height / bbox.height,
    placement.maxWidth ? placement.maxWidth / bbox.width : Infinity,
  );
  const w = bbox.width * scale;
  const h = bbox.height * scale;
  const x = placement.centerX - w / 2;
  const y = placement.groundY - h;

  paintEllipseGradient(
    ctx,
    placement.centerX,
    placement.groundY - 3,
    w * style.shadowScale,
    style.shadowRy,
    [
      [0, `rgba(0,0,0,${style.shadowAlpha})`],
      [1, "rgba(0,0,0,0)"],
    ],
  );

  ctx.save();
  if (placement.mirror) {
    ctx.translate(placement.centerX * 2, 0);
    ctx.scale(-1, 1);
  }

  ctx.save();
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = style.glowBlur;
  ctx.drawImage(img, bbox.minX, bbox.minY, bbox.width, bbox.height, x, y, w, h);
  ctx.restore();

  ctx.drawImage(img, bbox.minX, bbox.minY, bbox.width, bbox.height, x, y, w, h);
  ctx.restore();
}

export async function renderCard(
  paint: (ctx: SKRSContext2D) => Promise<void>,
): Promise<Buffer> {
  const canvas = createCanvas(W * SUPERSAMPLE, H * SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  ctx.imageSmoothingQuality = "high";

  await paint(ctx);

  const out = createCanvas(W, H);
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(canvas, 0, 0, W, H);
  return out.toBuffer("image/png");
}
