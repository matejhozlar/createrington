// Headless tool: composites the /team-tag social card (team-tag.png), a canvas
// rebuild of the editor's preview stage: the page's blurred mountain station
// backdrop, the close-up plate drawn pixel-exact from the same plate textures
// the game uses (with its floor shadow and reflection), and two members of a
// party standing under it. Figures come from the committed cache under
// assets/figures/; to refresh one, delete it and re-run with SKIN_API_KEY set.
//
// Run: pnpm --filter @createrington/server util:render-og-team-tag [outPath]

import { join } from "node:path";

import {
  createCanvas,
  loadImage,
  type Canvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import {
  PLATE_WIDTH,
  plateColumn,
  plateColumnColor,
  plateLetterColor,
  plateLetterStart,
  type PlateColumn,
  type PlateDesign,
} from "@createrington/shared/team-tag";
import { fitFontSize } from "@/utils/canvas";
import {
  W,
  H,
  BG_BOT,
  AMBER,
  FOREGROUND,
  MUTED,
  TEXT_X,
  registerBrandFonts,
  drawImageCover,
  paintEllipseGradient,
  paintUrlChip,
  paintWordmark,
  wrapText,
} from "@/utils/og-card";
import {
  ASSETS,
  paintPosedFigure,
  writeCard,
  type PosedFigureSpec,
} from "./og-shared";

const amber = (a: number) => `rgba(255,185,0,${a})`;

const TEAM_TAG_ASSETS = join(ASSETS, "team-tag");
const PLATE_LETTER_ROWS = ["ABCDEFGHIJKLMNOPQR", "STUVWXYZ0123456789"];
const PLATE_COLUMNS: readonly PlateColumn[] = ["edge", "rivet", "fill"];
const ROW_HEIGHT = 8;
const SHADOW_DIM = 0.25;

// The editor's starting design, so the card shows the plate a visitor sees
// first when the page opens.
const DESIGN: PlateDesign = {
  style: "riveted",
  tag: "CRTN",
  plate: 0xd9a441,
  letters: 0x3b230e,
  plateFade: null,
  letterFade: null,
};

const PLATE_ZOOM = 12;
const PLATE_CENTER_X = 900;
const PLATE_TOP = 168;

// Two members of the party cheering under their plate.
const FIGURES: readonly PosedFigureSpec[] = [
  {
    username: "Cailin05",
    uuid: "aee71815-6420-444c-a245-9047c41f4a39",
    pose: "cheer",
    height: 268,
    centerX: 792,
    groundY: 602,
  },
  {
    username: "Tetsuoken",
    uuid: "32ff995f-cf92-417b-b745-891738346120",
    pose: "cheer",
    height: 274,
    centerX: 1010,
    groundY: 606,
    mirror: true,
  },
];

type Bitmap = { width: number; height: number; data: Uint8ClampedArray };
type Glyph = { bitmap: Bitmap; x: number; color: number };

async function loadBitmap(file: string): Promise<Bitmap> {
  const img = await loadImage(join(TEAM_TAG_ASSETS, file));
  const ctx = createCanvas(img.width, img.height).getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, data };
}

function cropBitmap(
  source: Bitmap,
  x: number,
  y: number,
  width: number,
  height: number,
): Bitmap {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * source.width + x) * 4;
    data.set(source.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { width, height, data };
}

function glyphWidth(bitmap: Bitmap): number {
  let width = 0;
  for (let x = 0; x < bitmap.width; x++) {
    for (let y = 0; y < bitmap.height; y++) {
      if (bitmap.data[(y * bitmap.width + x) * 4 + 3] !== 0) width = x + 1;
    }
  }
  return width;
}

async function plateGlyphs(design: PlateDesign): Promise<Glyph[]> {
  const riveted = await loadBitmap("plate_riveted.png");
  const letters = await loadBitmap("plate_letters.png");
  const cellW = letters.width / PLATE_LETTER_ROWS[0].length;
  const cellH = letters.height / PLATE_LETTER_ROWS.length;

  const glyphs: Glyph[] = [];
  for (let x = 0; x < PLATE_WIDTH; x++) {
    const column = PLATE_COLUMNS.indexOf(plateColumn(x));
    glyphs.push({
      bitmap: cropBitmap(riveted, column, 0, 1, riveted.height),
      x,
      color: plateColumnColor(design, x),
    });
  }

  let x = plateLetterStart(design.tag);
  [...design.tag].forEach((char, i) => {
    const row = PLATE_LETTER_ROWS.findIndex((chars) => chars.includes(char));
    const col = PLATE_LETTER_ROWS[row].indexOf(char);
    const bitmap = cropBitmap(letters, col * cellW, row * cellH, cellW, cellH);
    glyphs.push({ bitmap, x, color: plateLetterColor(design, i) });
    x += glyphWidth(bitmap) + 1;
  });
  return glyphs;
}

// The game's text pass: every shadow of the line first, then the glyphs, with
// the colour applied as a multiply tint.
function blend(
  out: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const below = (out[i + 3] / 255) * (1 - a);
  const total = a + below;
  out[i] = (r * a + out[i] * below) / total;
  out[i + 1] = (g * a + out[i + 1] * below) / total;
  out[i + 2] = (b * a + out[i + 2] * below) / total;
  out[i + 3] = total * 255;
}

async function plateCanvas(design: PlateDesign): Promise<Canvas> {
  const glyphs = await plateGlyphs(design);
  const width = PLATE_WIDTH + 1;
  const height = ROW_HEIGHT + 1;
  const out = new Uint8ClampedArray(width * height * 4);

  for (const shadow of [true, false]) {
    const dim = shadow ? SHADOW_DIM : 1;
    const offset = shadow ? 1 : 0;
    for (const { bitmap, x, color } of glyphs) {
      const r = ((color >> 16) & 0xff) * dim;
      const g = ((color >> 8) & 0xff) * dim;
      const b = (color & 0xff) * dim;
      for (let py = 0; py < bitmap.height; py++) {
        for (let px = 0; px < bitmap.width; px++) {
          const src = (py * bitmap.width + px) * 4;
          const alpha = bitmap.data[src + 3];
          if (!alpha) continue;
          const dx = x + px + offset;
          const dy = py + offset;
          if (dx >= width || dy >= height) continue;
          blend(
            out,
            (dy * width + dx) * 4,
            (bitmap.data[src] * r) / 255,
            (bitmap.data[src + 1] * g) / 255,
            (bitmap.data[src + 2] * b) / 255,
            alpha / 255,
          );
        }
      }
    }
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(width, height);
  image.data.set(out);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// The page header treatment from HeroBackdrop: the mountain station blurred,
// darkened and desaturated, then faded into the page background.
async function paintBackdrop(ctx: SKRSContext2D): Promise<void> {
  ctx.fillStyle = BG_BOT;
  ctx.fillRect(0, 0, W, H);

  const hero = await loadImage(
    join(ASSETS, "hero", "mountains-train-station.webp"),
  );
  ctx.save();
  ctx.filter = "blur(6px) brightness(0.9) saturate(0.8)";
  drawImageCover(ctx, hero, -40, -40, W + 80, H + 80, "center");
  ctx.restore();

  const scrim = ctx.createLinearGradient(0, 0, 700, 0);
  scrim.addColorStop(0, "rgba(15,15,19,0.92)");
  scrim.addColorStop(0.55, "rgba(15,15,19,0.55)");
  scrim.addColorStop(1, "rgba(15,15,19,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, 700, H);

  const fade = ctx.createLinearGradient(0, H, 0, 0);
  fade.addColorStop(0, "rgba(11,11,14,0.9)");
  fade.addColorStop(0.3, "rgba(11,11,14,0.4)");
  fade.addColorStop(0.75, "rgba(11,11,14,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  paintEllipseGradient(ctx, 600, 315, 900, 470, [
    [0.45, "rgba(6,6,8,0)"],
    [1, "rgba(6,6,8,0.6)"],
  ]);
}

function paintPlateLight(ctx: SKRSContext2D, cy: number): void {
  paintEllipseGradient(ctx, PLATE_CENTER_X, cy, 330, 190, [
    [0, "rgba(255,200,110,0.18)"],
    [0.6, "rgba(255,200,110,0.05)"],
    [1, "rgba(255,200,110,0)"],
  ]);
}

async function paintPlate(ctx: SKRSContext2D): Promise<void> {
  const plate = await plateCanvas(DESIGN);
  const w = plate.width * PLATE_ZOOM;
  const h = plate.height * PLATE_ZOOM;
  const x = Math.round(PLATE_CENTER_X - w / 2);
  const y = PLATE_TOP;

  paintPlateLight(ctx, y + h / 2);

  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.ellipse(PLATE_CENTER_X, y + h - 2, w * 0.38, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(plate, x, y, w, h);

  const reflectionH = 34;
  const reflection = createCanvas(w, reflectionH);
  const rctx = reflection.getContext("2d");
  rctx.imageSmoothingEnabled = false;
  rctx.translate(0, reflectionH);
  rctx.scale(1, -1);
  rctx.drawImage(plate, 0, reflectionH - h, w, h);
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalCompositeOperation = "destination-in";
  const mask = rctx.createLinearGradient(0, 0, 0, reflectionH);
  mask.addColorStop(0, "rgba(0,0,0,0.9)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  rctx.fillStyle = mask;
  rctx.fillRect(0, 0, w, reflectionH);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.filter = "blur(1px)";
  ctx.drawImage(reflection, x, y + h);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
}

async function paintFigures(ctx: SKRSContext2D): Promise<void> {
  for (const spec of FIGURES) {
    await paintPosedFigure(ctx, spec, {
      glow: amber(0.3),
      glowBlur: 14,
      shadowScale: 0.6,
      shadowRy: 10,
      shadowAlpha: 0.55,
    });
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
    "your party's tag.",
    headFont,
    [72, 66, 60],
    maxTextWidth,
  );
  const line1Y = 286;
  const line2Y = line1Y + headSize + 6;

  ctx.font = headFont(headSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("Design", TEXT_X, line1Y);
  ctx.fillStyle = AMBER;
  ctx.fillText("your party's tag.", TEXT_X, line2Y);
  ctx.letterSpacing = "0px";

  const subFont = "400 22px Outfit";
  const subLines = wrapText(
    ctx,
    "Four letters, your colours, on every member's name in the tab list.",
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

  paintUrlChip(ctx, "createrington.com/team-tag", TEXT_X, subY + 4);
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ?? join(ASSETS, "og", "team-tag.png");

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    await paintBackdrop(ctx);
    await paintPlate(ctx);
    await paintFigures(ctx);
    await paintCopy(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
