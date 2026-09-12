// Headless tool: composites the /gallery social card (gallery.png), a canvas
// rebuild of the gallery hero: the metro build under the page's grayscale +
// fade treatment, a wall of pinned player screenshots, and two players
// standing in front of it looking up. Figures come from the committed cache
// under assets/figures/ (shared with every other og card, keyed by username
// and pose); to refresh one, delete it and re-run with SKIN_API_KEY set.
//
// Run: pnpm --filter @createrington/server util:render-og-gallery [outPath]

import { join } from "node:path";

import { loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { computeBBox, fitFontSize } from "@/utils/canvas";
import {
  W,
  H,
  BG_BOT,
  AMBER,
  FOREGROUND,
  MUTED,
  TEXT_X,
  ASSETS,
  registerBrandFonts,
  roundRectPath,
  drawImageCover,
  paintWordmark,
  getPoseFigure,
  writeCard,
} from "./og-shared";

const amber = (a: number) => `rgba(255,185,0,${a})`;

interface FrameSpec {
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

// The wall: real builds from the site's hero set, pinned at slightly
// different angles so it reads as printed photos rather than a UI grid.
const FRAMES: readonly FrameSpec[] = [
  {
    file: "gondola-station.webp",
    x: 636,
    y: 122,
    w: 246,
    h: 158,
    rotation: -3.4,
  },
  {
    file: "high-speed-train.webp",
    x: 910,
    y: 96,
    w: 232,
    h: 150,
    rotation: 2.6,
  },
  {
    file: "royal-albert-hall.webp",
    x: 668,
    y: 306,
    w: 214,
    h: 138,
    rotation: 2.2,
  },
  {
    file: "space-station.webp",
    x: 926,
    y: 282,
    w: 254,
    h: 164,
    rotation: -2.4,
  },
];

interface FigureSpec {
  username: string;
  uuid: string;
  pose: string;
  height: number;
  centerX: number;
  groundY: number;
  mirror?: boolean;
}

// Two players in front of the wall, taking it in.
const FIGURES: readonly FigureSpec[] = [
  {
    username: "The_BigShot",
    uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
    pose: "gaze",
    height: 178,
    centerX: 786,
    groundY: 596,
  },
  {
    username: "Cailin05",
    uuid: "aee71815-6420-444c-a245-9047c41f4a39",
    pose: "ponder",
    height: 172,
    centerX: 1046,
    groundY: 602,
    mirror: true,
  },
];

function paintEllipseGradient(
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

function wrapText(
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

// The page hero treatment from PageHeader: grayscale-50 over the metro build,
// a black/50 overlay, and the bottom fade into the page background.
async function paintBackdrop(ctx: SKRSContext2D): Promise<void> {
  ctx.fillStyle = BG_BOT;
  ctx.fillRect(0, 0, W, H);

  const hero = await loadImage(join(ASSETS, "hero", "metro.webp"));
  ctx.save();
  ctx.filter = "grayscale(0.5) brightness(0.72) blur(3px)";
  drawImageCover(ctx, hero, 0, 0, W, H, "center");
  ctx.restore();

  const scrim = ctx.createLinearGradient(0, 0, 700, 0);
  scrim.addColorStop(0, "rgba(15,15,19,0.95)");
  scrim.addColorStop(0.55, "rgba(15,15,19,0.62)");
  scrim.addColorStop(1, "rgba(15,15,19,0.12)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, 700, H);

  const fade = ctx.createLinearGradient(0, H, 0, 0);
  fade.addColorStop(0, "rgba(11,11,14,0.9)");
  fade.addColorStop(0.35, "rgba(11,11,14,0.45)");
  fade.addColorStop(0.8, "rgba(11,11,14,0.08)");
  fade.addColorStop(1, "rgba(11,11,14,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  paintEllipseGradient(ctx, 600, 315, 900, 470, [
    [0.45, "rgba(6,6,8,0)"],
    [1, "rgba(6,6,8,0.6)"],
  ]);
}

// A warm wash behind the wall, as if the photos are lit.
function paintWallLight(ctx: SKRSContext2D): void {
  paintEllipseGradient(ctx, 905, 280, 420, 300, [
    [0, "rgba(255,214,150,0.16)"],
    [0.6, "rgba(255,214,150,0.05)"],
    [1, "rgba(255,214,150,0)"],
  ]);
}

async function paintFrames(ctx: SKRSContext2D): Promise<void> {
  for (const spec of FRAMES) {
    const img = await loadImage(join(ASSETS, "hero", spec.file));
    const cx = spec.x + spec.w / 2;
    const cy = spec.y + spec.h / 2;
    const pad = 9;
    const outerW = spec.w + pad * 2;
    const outerH = spec.h + pad * 2 + 16;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((spec.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#f4f4f2";
    roundRectPath(ctx, cx - outerW / 2, cy - outerH / 2, outerW, outerH, 8);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, spec.x, cy - outerH / 2 + pad, spec.w, spec.h, 4);
    ctx.clip();
    drawImageCover(
      ctx,
      img,
      spec.x,
      cy - outerH / 2 + pad,
      spec.w,
      spec.h,
      "center",
    );
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    roundRectPath(
      ctx,
      spec.x + 0.5,
      cy - outerH / 2 + pad + 0.5,
      spec.w - 1,
      spec.h - 1,
      4,
    );
    ctx.stroke();

    ctx.restore();
  }
}

function paintFigure(ctx: SKRSContext2D, spec: FigureSpec, img: Image): void {
  const bbox = computeBBox(img);
  if (!bbox) throw new Error(`Empty figure render for ${spec.username}`);

  const scale = spec.height / bbox.height;
  const w = bbox.width * scale;
  const x = spec.centerX - w / 2;
  const y = spec.groundY - spec.height;

  paintEllipseGradient(ctx, spec.centerX, spec.groundY - 3, w * 0.6, 10, [
    [0, "rgba(0,0,0,0.55)"],
    [1, "rgba(0,0,0,0)"],
  ]);

  ctx.save();
  if (spec.mirror) {
    ctx.translate(spec.centerX * 2, 0);
    ctx.scale(-1, 1);
  }

  ctx.save();
  ctx.shadowColor = amber(0.32);
  ctx.shadowBlur = 14;
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

async function paintFigures(ctx: SKRSContext2D): Promise<void> {
  for (const spec of FIGURES) {
    const img = await getPoseFigure({
      uuid: spec.uuid,
      pose: spec.pose,
      username: spec.username,
    });
    paintFigure(ctx, spec, img);
  }
}

async function paintCopy(ctx: SKRSContext2D): Promise<void> {
  await paintWordmark(ctx);

  const maxTextWidth = 500;
  ctx.textBaseline = "alphabetic";

  const headFont = (s: number) => `700 ${s}px Outfit`;
  ctx.letterSpacing = "-1.4px";
  const headSize = fitFontSize(
    ctx,
    "through their eyes.",
    headFont,
    [72, 66, 60],
    maxTextWidth,
  );
  const line1Y = 286;
  const line2Y = line1Y + headSize + 6;

  ctx.font = headFont(headSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("The server,", TEXT_X, line1Y);
  ctx.fillStyle = AMBER;
  ctx.fillText("through their eyes.", TEXT_X, line2Y);
  ctx.letterSpacing = "0px";

  const subFont = "400 22px Outfit";
  const subLines = wrapText(
    ctx,
    "Builds, views and moments captured by the players of Createrington.",
    subFont,
    450,
  );
  ctx.font = subFont;
  ctx.fillStyle = MUTED;
  let subY = line2Y + 52;
  for (const line of subLines) {
    ctx.fillText(line, TEXT_X, subY);
    subY += 31;
  }

  const chipY = subY + 4;
  const chipH = 44;
  const padX = 20;
  const url = "createrington.com/gallery";
  ctx.font = "600 22px Outfit";
  const urlW = ctx.measureText(url).width;
  const chipW = padX * 2 + urlW;

  ctx.fillStyle = "rgba(255,185,0,0.10)";
  roundRectPath(ctx, TEXT_X, chipY, chipW, chipH, 11);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,185,0,0.40)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, TEXT_X + 0.5, chipY + 0.5, chipW - 1, chipH - 1, 11);
  ctx.stroke();

  ctx.fillStyle = AMBER;
  ctx.textBaseline = "middle";
  ctx.fillText(url, TEXT_X + padX, chipY + chipH / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ?? join(ASSETS, "og", "gallery.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    paintWallLight(ctx);
    await paintFrames(ctx);
    await paintFigures(ctx);
    await paintCopy(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
