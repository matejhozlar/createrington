// Headless tool: composites the /structure-packs social card
// (og-structure-packs.png), a canvas rebuild of the page hero: the Parallel
// Worlds portal (obsidian frame + animated sprite frame) over the blurred
// warehouse backdrop, the hero headline, and a "leading the vote" peek card.
//
// Run: pnpm --filter @createrington/server util:render-og-structure-packs [outPath]

import { join } from "node:path";

import {
  createCanvas,
  loadImage,
  type Canvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import { fitFontSize } from "@/utils/canvas";
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
  writeCard,
} from "./og-shared";

// Portal palette from the packs hero CSS (OkLCH converted to sRGB).
const blue = (a: number) => `rgba(29,132,245,${a})`;
const BAR_BLUE = "#5188cd";
const INTERIOR_STROKE = "rgba(213,223,235,0.3)";
const DUST = "rgb(120,170,255)";

const BLOCK = 72;
const PORTAL_COLS = 4;
const PORTAL_ROWS = 5;
const PORTAL_X = 736;
const PORTAL_Y = 56;
const PORTAL_FRAME = 0;

const PEEK_W = 360;
const PEEK_H = 168;
const PEEK_X = PORTAL_X + (PORTAL_COLS * BLOCK - PEEK_W) / 2;
const PEEK_Y = PORTAL_Y + PORTAL_ROWS * BLOCK + 18;

interface PoolRow {
  name: string;
  pct: number;
}

const POOL: readonly PoolRow[] = [
  { name: "qraftyfied", pct: 17 },
  { name: "YUNG's", pct: 15 },
  { name: "Vanilla +", pct: 13 },
];

// 16x16 obsidian tile transcribed from the packs hero tile SVG; every speck
// is a 1px-tall run of [x, y, width, color].
const OBSIDIAN_BASE = "#060a12";
const OBSIDIAN_SPECKS: readonly (readonly [number, number, number, string])[] =
  [
    [0, 0, 16, "#0a121f"],
    [2, 1, 1, "#121c33"],
    [6, 0, 1, "#182644"],
    [11, 1, 2, "#101a30"],
    [14, 0, 1, "#1c2c4a"],
    [1, 3, 1, "#15244a"],
    [4, 4, 2, "#0e182b"],
    [8, 3, 1, "#1e3055"],
    [12, 4, 1, "#101c34"],
    [0, 6, 1, "#182a48"],
    [3, 6, 1, "#09141f"],
    [6, 7, 2, "#1a2848"],
    [10, 6, 1, "#0e182a"],
    [14, 7, 1, "#162440"],
    [2, 9, 1, "#121e38"],
    [5, 9, 1, "#20305a"],
    [9, 10, 2, "#101a30"],
    [13, 10, 1, "#162440"],
    [0, 12, 2, "#0e182b"],
    [4, 12, 1, "#1e2e52"],
    [7, 12, 1, "#121c36"],
    [11, 13, 1, "#1a2848"],
    [3, 14, 1, "#162440"],
    [8, 14, 2, "#0e182a"],
    [13, 14, 1, "#121e36"],
    [0, 15, 16, "#03060b"],
  ];

const isInterior = (r: number, c: number) =>
  r >= 1 && r <= 3 && c >= 1 && c <= 2;

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

async function paintBackdrop(ctx: SKRSContext2D): Promise<void> {
  ctx.fillStyle = BG_BOT;
  ctx.fillRect(0, 0, W, H);

  const hero = await loadImage(join(ASSETS, "hero", "dark-warehouse.webp"));
  ctx.save();
  ctx.filter = "grayscale(0.5) blur(4px) brightness(0.44)";
  drawImageCover(ctx, hero, -24, -24, W + 48, H + 48, "center");
  ctx.restore();

  paintEllipseGradient(ctx, W * 0.72, H * 0.55, W * 0.55, H * 0.75, [
    [0, "rgba(0,68,149,0.48)"],
    [0.55, "rgba(0,68,149,0)"],
    [1, "rgba(0,68,149,0)"],
  ]);

  paintEllipseGradient(ctx, W / 2, H / 2, 850, 450, [
    [0.4, "rgba(7,7,9,0)"],
    [1, "rgba(7,7,9,0.8)"],
  ]);
}

function paintDust(ctx: SKRSContext2D): void {
  const rand = mulberry32(7);
  for (let i = 0; i < 34; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 1 + rand() * 1.8;
    ctx.save();
    ctx.globalAlpha = 0.2 + rand() * 0.55;
    ctx.shadowColor = "rgba(120,170,255,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = DUST;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintGrain(ctx: SKRSContext2D): void {
  const size = 96;
  const tile = createCanvas(size, size);
  const tctx = tile.getContext("2d");
  const img = tctx.createImageData(size, size);
  const rand = mulberry32(13);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = ctx.createPattern(tile, "repeat");
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function buildObsidianTile(): Canvas {
  const tile = createCanvas(16, 16);
  const tctx = tile.getContext("2d");
  tctx.fillStyle = OBSIDIAN_BASE;
  tctx.fillRect(0, 0, 16, 16);
  for (const [x, y, w, color] of OBSIDIAN_SPECKS) {
    tctx.fillStyle = color;
    tctx.fillRect(x, y, w, 1);
  }
  return tile;
}

async function paintPortal(ctx: SKRSContext2D): Promise<void> {
  const w = PORTAL_COLS * BLOCK;
  const h = PORTAL_ROWS * BLOCK;
  const x0 = PORTAL_X;
  const y0 = PORTAL_Y;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;

  paintEllipseGradient(ctx, cx, cy, w * 1.15, h * 0.85, [
    [0, blue(0.5)],
    [0.35, blue(0.17)],
    [0.68, blue(0)],
    [1, blue(0)],
  ]);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#000";
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = blue(0.35);
  ctx.shadowBlur = 90;
  ctx.fillStyle = "#000";
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();

  const tile = buildObsidianTile();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < PORTAL_ROWS; r++) {
    for (let c = 0; c < PORTAL_COLS; c++) {
      if (isInterior(r, c)) continue;
      ctx.drawImage(tile, x0 + c * BLOCK, y0 + r * BLOCK, BLOCK, BLOCK);
    }
  }
  ctx.restore();

  ctx.lineWidth = 1;
  for (let r = 0; r < PORTAL_ROWS; r++) {
    for (let c = 0; c < PORTAL_COLS; c++) {
      if (isInterior(r, c)) continue;
      const bx = x0 + c * BLOCK;
      const by = y0 + r * BLOCK;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeRect(bx + 0.5, by + 0.5, BLOCK - 1, BLOCK - 1);
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fillRect(bx, by, BLOCK, 1);
    }
  }

  const ix = x0 + BLOCK;
  const iy = y0 + BLOCK;
  const iw = BLOCK * 2;
  const ih = BLOCK * 3;
  const sprite = await loadImage(
    join(ASSETS, "parallel-worlds", "pw-portal.png"),
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();

  paintEllipseGradient(ctx, ix + iw / 2, iy + ih / 2, iw * 0.7, ih * 0.7, [
    [0, "#311c94"],
    [0.8, "#0a043c"],
    [1, "#030318"],
  ]);

  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.drawImage(
        sprite,
        0,
        PORTAL_FRAME * 16,
        16,
        16,
        ix + c * BLOCK,
        iy + r * BLOCK,
        BLOCK,
        BLOCK,
      );
    }
  }
  ctx.imageSmoothingEnabled = true;

  paintEllipseGradient(ctx, ix + iw / 2, iy + ih / 2, iw * 0.72, ih * 0.72, [
    [0, blue(0.18)],
    [0.55, blue(0.3)],
    [1, blue(0.55)],
  ]);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let y = iy; y < iy + ih; y += 4) ctx.fillRect(ix, y, iw, 2);
  ctx.restore();

  ctx.restore();

  ctx.strokeStyle = INTERIOR_STROKE;
  ctx.lineWidth = 1;
  ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
}

function paintTrendingUp(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
): void {
  const px = (vx: number) => x + (vx / 24) * s;
  const py = (vy: number) => y + (vy / 24) * s;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px(2), py(17));
  ctx.lineTo(px(8.5), py(10.5));
  ctx.lineTo(px(13.5), py(15.5));
  ctx.lineTo(px(22), py(7));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px(16), py(7));
  ctx.lineTo(px(22), py(7));
  ctx.lineTo(px(22), py(13));
  ctx.stroke();
  ctx.restore();
}

function paintPeekCard(ctx: SKRSContext2D): void {
  const x = PEEK_X;
  const y = PEEK_Y;
  const w = PEEK_W;
  const h = PEEK_H;
  const pad = 18;

  roundRectPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = "rgba(16,16,21,0.78)";
  ctx.fill();

  const tint = ctx.createLinearGradient(x, y, x + w, y + h);
  tint.addColorStop(0, "rgba(255,185,0,0.07)");
  tint.addColorStop(1, "rgba(255,185,0,0)");
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = tint;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,185,0,0.32)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 14);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "2.2px";
  ctx.font = "600 11px Outfit";
  ctx.fillStyle = "rgba(255,185,0,0.9)";
  ctx.fillText("LEADING THE VOTE", x + pad, y + 27);
  ctx.letterSpacing = "0px";

  paintTrendingUp(ctx, x + w - pad - 15, y + 14, 15, AMBER);

  const leader = POOL[0];
  ctx.font = "700 21px Outfit";
  ctx.fillStyle = FOREGROUND;
  ctx.fillText(leader.name, x + pad, y + 58);
  ctx.textAlign = "right";
  ctx.fillStyle = AMBER;
  ctx.fillText(`${leader.pct}%`, x + w - pad, y + 58);
  ctx.textAlign = "left";

  const trackX = x + pad + 102;
  const trackW = w - pad * 2 - 102 - 34;
  const rows = [y + 82, y + 102, y + 122];
  POOL.forEach((row, i) => {
    const rowY = rows[i];
    ctx.font = "400 11.5px Outfit";
    ctx.fillStyle = MUTED;
    ctx.fillText(row.name, x + pad, rowY + 4, 96);

    roundRectPath(ctx, trackX, rowY - 2.5, trackW, 5, 2.5);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();

    const fillW = Math.max(5, (trackW * row.pct) / 100);
    ctx.save();
    ctx.shadowColor = i === 0 ? "rgba(255,185,0,0.7)" : blue(0.5);
    ctx.shadowBlur = i === 0 ? 8 : 6;
    roundRectPath(ctx, trackX, rowY - 2.5, fillW, 5, 2.5);
    ctx.fillStyle = i === 0 ? AMBER : BAR_BLUE;
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "right";
    ctx.fillStyle = MUTED;
    ctx.fillText(`${row.pct}%`, x + w - pad, rowY + 4);
    ctx.textAlign = "left";
  });

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + h - 32.5);
  ctx.lineTo(x + w - pad, y + h - 32.5);
  ctx.stroke();

  ctx.letterSpacing = "2px";
  ctx.font = "500 9.5px Outfit";
  ctx.textAlign = "center";
  const credit = "PARALLEL WORLDS BY ";
  const author = "AGENT772";
  const creditW = ctx.measureText(credit).width;
  const authorW = ctx.measureText(author).width;
  const creditX = x + w / 2 - (creditW + authorW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.fillText(credit, creditX, y + h - 13);
  ctx.fillStyle = "rgba(255,185,0,0.9)";
  ctx.fillText(author, creditX + creditW, y + h - 13);
  ctx.letterSpacing = "0px";
}

async function paintCopy(ctx: SKRSContext2D): Promise<void> {
  const wood = await loadImage(
    join(ASSETS, "logo", "cogs-and-steam-logo.webp"),
  );
  const woodW = 300;
  const woodH = (woodW * wood.height) / wood.width;
  ctx.drawImage(wood, TEXT_X, 52, woodW, woodH);

  const maxTextWidth = 520;
  ctx.textBaseline = "alphabetic";

  const headFont = (s: number) => `700 ${s}px Outfit`;
  ctx.letterSpacing = "-1.4px";
  const headSize = fitFontSize(
    ctx,
    "next world.",
    headFont,
    [72, 66, 60],
    maxTextWidth,
  );
  const line1Y = 286;
  const line2Y = line1Y + headSize + 6;

  ctx.font = headFont(headSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("Shape the", TEXT_X, line1Y);
  ctx.fillStyle = AMBER;
  ctx.fillText("next world", TEXT_X, line2Y);
  const nwW = ctx.measureText("next world").width;
  ctx.fillStyle = FOREGROUND;
  ctx.fillText(".", TEXT_X + nwW, line2Y);
  ctx.letterSpacing = "0px";

  const subFont = "400 22px Outfit";
  const subLines = wrapText(
    ctx,
    "Spend in-game currency to boost the themed dimension you want next. Weighted voting decides what appears through the portal.",
    subFont,
    470,
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
  const url = "createrington.com/structure-packs";
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
  const outPath =
    process.argv[2] ?? join(ASSETS, "og", "og-structure-packs.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    paintDust(ctx);
    await paintPortal(ctx);
    paintPeekCard(ctx);
    await paintCopy(ctx);
    paintGrain(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
