// Headless tool: composites the /workshop social card (workshop.png), a canvas
// rebuild of the workshop hub hero: the Royal Albert Hall build with the
// page's grayscale + fade treatment, a spotlit pixel chest (the next pack)
// swallowing suggested mods, and the community trio reacting around it.
// Figures are cached under assets/workshop/ (committed); to refresh, delete
// the cache and re-run with SKIN_API_KEY in the environment. Mod logos are
// fetched from the CurseForge CDN at render time.
//
// Run: pnpm --filter @createrington/server util:render-og-workshop [outPath]

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCanvas,
  loadImage,
  type Canvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";
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
  paintWordmark,
  getPoseFigure,
  writeCard,
} from "./og-shared";

const here = dirname(fileURLToPath(import.meta.url));
const WORKSHOP_DIR = join(here, "assets", "workshop");

// Upvote red from the workshop leaderboard heart (Tailwind red-400, OkLCH
// converted to sRGB).
const red = (a: number) => `rgba(255,100,103,${a})`;
const amber = (a: number) => `rgba(255,185,0,${a})`;
const HEART_FILL = "#ff6467";

// Chest geometry: 14 texels wide, base 9 texels tall, TEXEL px per texel.
const TEXEL = 15;
const CHEST_CX = 975;
const CHEST_BOTTOM = 608;
const CHEST_W = 14 * TEXEL;
const CHEST_BASE_H = 9 * TEXEL;
const CHEST_X = CHEST_CX - CHEST_W / 2;
const MOUTH_Y = CHEST_BOTTOM - CHEST_BASE_H;
// Offscreen chest canvas layout: headroom above the mouth for the open lid.
// The lid stands up behind the box like an actual opened chest, hinged at the
// back edge of the top opening, which sits CHEST_OPEN_DEPTH deep in a slight
// top-down perspective.
const CHEST_PAD = 40;
const LID_SPACE = 130;
const CHEST_OPEN_DEPTH = 24;
const CHEST_LID_RISE = 72;

interface FigureSpec {
  username: string;
  uuid: string;
  pose: string;
  height: number;
  centerX: number;
  groundY: number;
  mirror?: boolean;
}

// Gathered around the pack: diablothe2nd points at the votes raining in
// (mirrored so the arm aims at the hearts), Tetsuoken cheers them on,
// The_BigShot weighs his next suggestion.
const FIGURES: readonly FigureSpec[] = [
  {
    username: "The_BigShot",
    uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
    pose: "ponder",
    height: 205,
    centerX: 723,
    groundY: 610,
  },
  {
    username: "diablothe2nd",
    uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f",
    pose: "point",
    height: 222,
    centerX: 836,
    groundY: 622,
    mirror: true,
  },
  {
    username: "Tetsuoken",
    uuid: "32ff995f-cf92-417b-b745-891738346120",
    pose: "cheer",
    height: 210,
    centerX: 1140,
    groundY: 614,
  },
];

interface LogoSpec {
  url: string;
  x: number;
  y: number;
  size: number;
  alpha: number;
  rotation: number;
  sink?: boolean;
}

// Suggested mods arcing down into the chest: real CurseForge logos from the
// pack, growing as they approach the mouth. Pulled from the CurseForge CDN at
// render time, so regenerating this card needs network but no key.
const CDN = "https://media.forgecdn.net/avatars/thumbnails";
const MOD_LOGOS: readonly LogoSpec[] = [
  {
    url: `${CDN}/1065/609/256/256/638599304770885171.webp`,
    x: 826,
    y: 160,
    size: 42,
    alpha: 0.8,
    rotation: -12,
  },
  {
    url: `${CDN}/396/11/256/256/637595005615179370.png`,
    x: 888,
    y: 214,
    size: 50,
    alpha: 0.88,
    rotation: 9,
  },
  {
    url: `${CDN}/922/162/256/256/638387242479713653.png`,
    x: 942,
    y: 278,
    size: 58,
    alpha: 0.94,
    rotation: -7,
  },
  {
    url: `${CDN}/1292/539/256/256/638840245429346229.png`,
    x: 978,
    y: 348,
    size: 66,
    alpha: 1,
    rotation: 6,
  },
  {
    url: `${CDN}/1065/184/256/256/638598725500886388.png`,
    x: 985,
    y: 445,
    size: 76,
    alpha: 1,
    rotation: -4,
    sink: true,
  },
];

interface HeartSpec {
  x: number;
  y: number;
  size: number;
  alpha: number;
  rotation: number;
}

// A few upvotes drifting alongside the suggestions.
const HEARTS: readonly HeartSpec[] = [
  { x: 868, y: 302, size: 15, alpha: 0.55, rotation: -10 },
  { x: 1048, y: 238, size: 17, alpha: 0.6, rotation: 12 },
  { x: 918, y: 150, size: 13, alpha: 0.45, rotation: 8 },
];

// Oak chest pixel maps in the vanilla chest's plank style: horizontal plank
// bands inside a darker frame, grain specks, a shadowed bottom row.
const CHEST_PALETTE: Record<string, string> = {
  "#": "#5a3c1f",
  "-": "#b0874f",
  "=": "#9a7345",
  ".": "#7d5a34",
  _: "#4e3316",
  u: "#71512c",
  d: "#3c2711",
};

const CHEST_BASE_FRONT: readonly string[] = [
  "##############",
  "#------------#",
  "#=====.======#",
  "#-----=------#",
  "#==.=====.===#",
  "#------=-----#",
  "#===.======.=#",
  "#____________#",
  "##############",
];

const CHEST_LID_UNDERSIDE: readonly string[] = [
  "dddddddddddd",
  "duuuuuuuuuud",
  "du.uu.uu.uud",
  "duuuuuuuuuud",
  "dddddddddddd",
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

function drawPixelMap(
  ctx: SKRSContext2D,
  map: readonly string[],
  x: number,
  y: number,
  cellW = TEXEL,
  cellH = TEXEL,
): void {
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const color = CHEST_PALETTE[map[r][c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * cellW, y + r * cellH, cellW, cellH);
    }
  }
}

function heartPath(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const w = size;
  const h = size * 0.92;
  const x = cx;
  const y = cy - h * 0.42;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.28);
  ctx.bezierCurveTo(x, y + h * 0.12, x - w * 0.16, y, x - w * 0.28, y);
  ctx.bezierCurveTo(
    x - w * 0.48,
    y,
    x - w * 0.5,
    y + h * 0.22,
    x - w * 0.5,
    y + h * 0.28,
  );
  ctx.bezierCurveTo(
    x - w * 0.5,
    y + h * 0.48,
    x - w * 0.28,
    y + h * 0.64,
    x,
    y + h * 0.85,
  );
  ctx.bezierCurveTo(
    x + w * 0.28,
    y + h * 0.64,
    x + w * 0.5,
    y + h * 0.48,
    x + w * 0.5,
    y + h * 0.28,
  );
  ctx.bezierCurveTo(
    x + w * 0.5,
    y + h * 0.22,
    x + w * 0.48,
    y,
    x + w * 0.28,
    y,
  );
  ctx.bezierCurveTo(x + w * 0.16, y, x, y + h * 0.12, x, y + h * 0.28);
  ctx.closePath();
}

// The page hero treatment from WorkshopHero.tsx: grayscale-50, a black/30
// overlay (folded into brightness), and the hub gradient fading into the page
// background at the bottom. The crop is biased down so the stage and galleries
// stay in frame.
async function paintBackdrop(ctx: SKRSContext2D): Promise<void> {
  ctx.fillStyle = BG_BOT;
  ctx.fillRect(0, 0, W, H);

  const hero = await loadImage(join(ASSETS, "hero", "royal-albert-hall.webp"));
  const pad = 24;
  const scale = Math.max(
    (W + pad * 2) / hero.width,
    (H + pad * 2) / hero.height,
  );
  const drawW = hero.width * scale;
  const drawH = hero.height * scale;
  const overflowY = drawH - (H + pad * 2);
  ctx.save();
  ctx.filter = "grayscale(0.4) brightness(0.92) blur(2px)";
  ctx.drawImage(
    hero,
    -pad - (drawW - (W + pad * 2)) / 2,
    -pad - overflowY * 0.62,
    drawW,
    drawH,
  );
  ctx.restore();

  const scrim = ctx.createLinearGradient(0, 0, 720, 0);
  scrim.addColorStop(0, "rgba(15,15,19,0.94)");
  scrim.addColorStop(0.5, "rgba(15,15,19,0.6)");
  scrim.addColorStop(1, "rgba(15,15,19,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, 720, H);

  const fade = ctx.createLinearGradient(0, H, 0, 0);
  fade.addColorStop(0, "rgba(15,15,19,0.75)");
  fade.addColorStop(0.4, "rgba(15,15,19,0.38)");
  fade.addColorStop(0.75, "rgba(15,15,19,0.1)");
  fade.addColorStop(1, "rgba(15,15,19,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  paintEllipseGradient(ctx, 520, 315, 950, 480, [
    [0.5, "rgba(7,7,9,0)"],
    [1, "rgba(7,7,9,0.55)"],
  ]);
}

// Two soft warm spotlight cones converging on the chest, as if the pack is on
// stage.
function paintSpotlights(ctx: SKRSContext2D): void {
  const beams = [
    { topX: 880, topW: 70, baseX: 960, baseW: 320 },
    { topX: 1140, topW: 60, baseX: 1030, baseW: 280 },
  ];
  for (const b of beams) {
    ctx.save();
    ctx.filter = "blur(14px)";
    const g = ctx.createLinearGradient(0, -20, 0, 645);
    g.addColorStop(0, "rgba(255,214,150,0.22)");
    g.addColorStop(0.7, "rgba(255,214,150,0.07)");
    g.addColorStop(1, "rgba(255,214,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.topX - b.topW / 2, -20);
    ctx.lineTo(b.topX + b.topW / 2, -20);
    ctx.lineTo(b.baseX + b.baseW / 2, 645);
    ctx.lineTo(b.baseX - b.baseW / 2, 645);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Builds the open chest on an offscreen canvas, back to front: the lid
// standing up behind the box (underside facing the viewer, hinged at the back
// edge), the glowing top opening in slight perspective, the plank base, and
// the latch centered on the front.
function buildChest(): Canvas {
  const canvas = createCanvas(
    CHEST_W + CHEST_PAD * 2,
    LID_SPACE + CHEST_BASE_H + CHEST_PAD,
  );
  const ctx = canvas.getContext("2d");
  const bx = CHEST_PAD;
  const mouthY = LID_SPACE;
  const backY = mouthY - CHEST_OPEN_DEPTH;
  const inset = 12;
  const lidW = CHEST_W - inset * 2;
  const lidTop = backY - CHEST_LID_RISE;

  ctx.imageSmoothingEnabled = false;

  drawPixelMap(
    ctx,
    CHEST_LID_UNDERSIDE,
    bx + inset,
    lidTop,
    lidW / 12,
    CHEST_LID_RISE / 5,
  );
  const sheen = ctx.createLinearGradient(0, lidTop, 0, backY);
  sheen.addColorStop(0, amber(0));
  sheen.addColorStop(0.6, amber(0.1));
  sheen.addColorStop(1, amber(0.45));
  ctx.fillStyle = sheen;
  ctx.fillRect(bx + inset + 4, lidTop + 4, lidW - 8, CHEST_LID_RISE - 4);

  ctx.beginPath();
  ctx.moveTo(bx, mouthY);
  ctx.lineTo(bx + inset, backY);
  ctx.lineTo(bx + CHEST_W - inset, backY);
  ctx.lineTo(bx + CHEST_W, mouthY);
  ctx.closePath();
  ctx.fillStyle = "#2b1a08";
  ctx.fill();
  ctx.save();
  ctx.clip();
  paintEllipseGradient(
    ctx,
    bx + CHEST_W / 2,
    mouthY - CHEST_OPEN_DEPTH / 2,
    CHEST_W * 0.4,
    CHEST_OPEN_DEPTH,
    [
      [0, amber(0.6)],
      [0.6, amber(0.22)],
      [1, amber(0)],
    ],
  );
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(bx + inset, backY, lidW, 3);

  drawPixelMap(ctx, CHEST_BASE_FRONT, bx, mouthY);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(bx + TEXEL, mouthY + 2, CHEST_W - 2 * TEXEL, 2);

  const latchW = TEXEL * 2;
  const latchH = TEXEL * 2.5;
  const latchX = bx + CHEST_W / 2 - latchW / 2;
  const latchY = mouthY - 8;
  ctx.fillStyle = "#3c3c3c";
  ctx.fillRect(latchX - 3, latchY - 3, latchW + 6, latchH + 6);
  ctx.fillStyle = "#c9c9c9";
  ctx.fillRect(latchX, latchY, latchW, latchH / 2);
  ctx.fillStyle = "#8f8f8f";
  ctx.fillRect(latchX, latchY + latchH / 2, latchW, latchH / 2);
  ctx.fillStyle = "#55555f";
  ctx.fillRect(latchX + latchW / 2 - 3, latchY + latchH / 2 - 5, 6, 10);

  return canvas;
}

// The next pack: an open oak chest under the spotlights, amber loot-light
// pouring out of the mouth.
function paintChest(ctx: SKRSContext2D): void {
  paintEllipseGradient(ctx, CHEST_CX, CHEST_BOTTOM + 2, 200, 30, [
    [0, "rgba(0,0,0,0.55)"],
    [1, "rgba(0,0,0,0)"],
  ]);

  const shaft = ctx.createLinearGradient(0, 160, 0, MOUTH_Y - CHEST_OPEN_DEPTH);
  shaft.addColorStop(0, amber(0));
  shaft.addColorStop(0.7, amber(0.08));
  shaft.addColorStop(1, amber(0.26));
  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(CHEST_X + 34, 160);
  ctx.lineTo(CHEST_X + CHEST_W - 34, 160);
  ctx.lineTo(CHEST_X + CHEST_W - 10, MOUTH_Y - CHEST_OPEN_DEPTH);
  ctx.lineTo(CHEST_X + 10, MOUTH_Y - CHEST_OPEN_DEPTH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const chest = buildChest();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(chest, CHEST_X - CHEST_PAD, MOUTH_Y - LID_SPACE);
  ctx.restore();

  paintEllipseGradient(ctx, CHEST_CX, MOUTH_Y - CHEST_OPEN_DEPTH / 2, 140, 42, [
    [0, amber(0.55)],
    [0.5, amber(0.16)],
    [1, amber(0)],
  ]);

  const sparks = [
    { x: 928, y: 428, r: 2.8 },
    { x: 1016, y: 416, r: 3.2 },
    { x: 958, y: 402, r: 2.4 },
    { x: 1042, y: 438, r: 2.6 },
    { x: 990, y: 380, r: 2.2 },
  ];
  for (const s of sparks) {
    ctx.save();
    ctx.shadowColor = amber(0.9);
    ctx.shadowBlur = 8;
    ctx.fillStyle = AMBER;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

async function paintFigures(ctx: SKRSContext2D): Promise<void> {
  // Figures arrive with hard alphaTest edges; the downscale to spec.height is
  // what anti-aliases them, so smoothing must be on here regardless of what
  // the pixel-art painters left it set to.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (const spec of FIGURES) {
    const img = await getPoseFigure({
      uuid: spec.uuid,
      pose: spec.pose,
      file: join(WORKSHOP_DIR, `${spec.username}-${spec.pose}.png`),
    });
    const bbox = computeBBox(img);
    if (!bbox) throw new Error(`Empty figure render for ${spec.username}`);

    const scale = spec.height / bbox.height;
    const w = bbox.width * scale;
    const x = spec.centerX - w / 2;
    const y = spec.groundY - spec.height;

    paintEllipseGradient(ctx, spec.centerX, spec.groundY - 3, w * 0.62, 11, [
      [0, "rgba(0,0,0,0.5)"],
      [1, "rgba(0,0,0,0)"],
    ]);

    ctx.save();
    if (spec.mirror) {
      ctx.translate(spec.centerX * 2, 0);
      ctx.scale(-1, 1);
    }

    ctx.save();
    ctx.shadowColor = amber(0.35);
    ctx.shadowBlur = 12;
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
}

async function paintModLogos(ctx: SKRSContext2D): Promise<void> {
  for (const spec of MOD_LOGOS) {
    const res = await fetch(spec.url);
    if (!res.ok) {
      throw new Error(`logo fetch failed (${res.status}): ${spec.url}`);
    }
    const img = await loadImage(Buffer.from(await res.arrayBuffer()));
    const half = spec.size / 2;

    ctx.save();
    if (spec.sink) {
      ctx.beginPath();
      ctx.rect(0, 0, W, MOUTH_Y);
      ctx.clip();
    }
    ctx.translate(spec.x, spec.y);
    ctx.rotate((spec.rotation * Math.PI) / 180);
    ctx.globalAlpha = spec.alpha;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(img, -half, -half, spec.size, spec.size);
    ctx.restore();
  }
}

function paintHearts(ctx: SKRSContext2D): void {
  for (const spec of HEARTS) {
    ctx.save();
    ctx.translate(spec.x, spec.y);
    ctx.rotate((spec.rotation * Math.PI) / 180);
    ctx.globalAlpha = spec.alpha;

    ctx.save();
    ctx.shadowColor = red(0.8);
    ctx.shadowBlur = Math.max(10, spec.size * 0.4);
    heartPath(ctx, 0, 0, spec.size);
    ctx.fillStyle = HEART_FILL;
    ctx.fill();
    ctx.restore();

    heartPath(ctx, 0, 0, spec.size);
    ctx.fillStyle = HEART_FILL;
    ctx.fill();
    ctx.lineWidth = Math.max(2, spec.size * 0.08);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();

    ctx.restore();
  }
}

async function paintCopy(ctx: SKRSContext2D): Promise<void> {
  await paintWordmark(ctx);

  const maxTextWidth = 520;
  ctx.textBaseline = "alphabetic";

  const headFont = (s: number) => `700 ${s}px Outfit`;
  ctx.letterSpacing = "-1.4px";
  const headSize = fitFontSize(
    ctx,
    "What ships next?",
    headFont,
    [72, 66, 60],
    maxTextWidth,
  );
  const line1Y = 286;
  const line2Y = line1Y + headSize + 6;

  ctx.font = headFont(headSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("What ships next?", TEXT_X, line1Y);
  ctx.fillStyle = AMBER;
  ctx.fillText("You decide.", TEXT_X, line2Y);
  ctx.letterSpacing = "0px";

  const subFont = "400 22px Outfit";
  const subLines = wrapText(
    ctx,
    "Suggest mods, upvote your favorites, and build the next modpack together.",
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
  const url = "createrington.com/workshop";
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
  const outPath = process.argv[2] ?? join(ASSETS, "og", "workshop.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    paintSpotlights(ctx);
    paintChest(ctx);
    await paintFigures(ctx);
    await paintModLogos(ctx);
    paintHearts(ctx);
    await paintCopy(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
