// Headless tool: composites the /gallery social card (gallery.png), a canvas
// rebuild of the gallery hero: the metro build under the page's grayscale +
// fade treatment, a wall of pinned player screenshots, and two players
// standing in front of it looking up. Figures come from the committed cache
// under assets/figures/ (shared with every other og card, keyed by username
// and pose); to refresh one, delete it and re-run with SKIN_API_KEY set.
//
// Run: pnpm --filter @createrington/server util:render-og-gallery [outPath]

import { join } from "node:path";

import { loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import {
  W,
  H,
  BG_BOT,
  registerBrandFonts,
  roundRectPath,
  drawImageCover,
  paintEllipseGradient,
  paintHeadlineCopy,
  type HeadlineCopy,
} from "@/utils/og-card";
import {
  ASSETS,
  TEAM,
  paintPosedFigure,
  writeCard,
  type PosedFigureSpec,
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

// Two players in front of the wall, taking it in.
const FIGURES: readonly PosedFigureSpec[] = [
  {
    ...TEAM.The_BigShot,
    pose: "gaze",
    height: 178,
    centerX: 786,
    groundY: 596,
  },
  {
    ...TEAM.Cailin05,
    pose: "ponder",
    height: 172,
    centerX: 1046,
    groundY: 602,
    mirror: true,
  },
];

const COPY: HeadlineCopy = {
  lead: "The server,",
  accent: "through their eyes.",
  sub: "Builds, views and moments captured by the players of Createrington.",
  subWidth: 450,
  url: "createrington.com/gallery",
};

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

async function paintFigures(ctx: SKRSContext2D): Promise<void> {
  for (const spec of FIGURES) {
    await paintPosedFigure(ctx, spec, {
      glow: amber(0.32),
      glowBlur: 14,
      shadowScale: 0.6,
      shadowRy: 10,
      shadowAlpha: 0.55,
    });
  }
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ?? join(ASSETS, "og", "gallery.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    paintWallLight(ctx);
    await paintFrames(ctx);
    await paintFigures(ctx);
    await paintHeadlineCopy(ctx, COPY);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
