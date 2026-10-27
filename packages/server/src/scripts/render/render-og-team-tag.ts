// Headless tool: composites the /team-tag social card (team-tag.png): the
// editor page's blurred mountain station backdrop with a pile of team tag
// plates in different colours and fades, each drawn pixel-exact from the same
// plate textures the game uses. The editor's starting plate (CRTN, brass) lies
// on top of the pile.
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
import { ASSETS, writeCard } from "./og-shared";

const TEAM_TAG_ASSETS = join(ASSETS, "team-tag");
const PLATE_LETTER_ROWS = ["ABCDEFGHIJKLMNOPQR", "STUVWXYZ0123456789"];
const PLATE_COLUMNS: readonly PlateColumn[] = ["edge", "rivet", "fill"];
const ROW_HEIGHT = 8;
const SHADOW_DIM = 0.25;

interface PileSpec {
  tag: string;
  plate: number;
  letters: number;
  plateFade?: number;
  letterFade?: number;
  cx: number;
  cy: number;
  zoom: number;
  rotation: number;
  shade?: number;
}

// Back to front: the farther plates are smaller and darker, the editor's
// starting plate is painted last so it lies on top.
const PILE: readonly PileSpec[] = [
  {
    tag: "MILL",
    plate: 0x9a9c97,
    letters: 0x222421,
    cx: 760,
    cy: 236,
    zoom: 6,
    rotation: -13,
    shade: 0.55,
  },
  {
    tag: "DOCK",
    plate: 0x2d5b8a,
    letters: 0xffe49a,
    plateFade: 0x3fa37a,
    cx: 1078,
    cy: 210,
    zoom: 6,
    rotation: 11,
    shade: 0.55,
  },
  {
    tag: "BEES",
    plate: 0xffd23f,
    letters: 0x2b1d00,
    cx: 922,
    cy: 176,
    zoom: 6,
    rotation: -4,
    shade: 0.55,
  },
  {
    tag: "LAVA",
    plate: 0xb5302a,
    letters: 0xffe49a,
    plateFade: 0xff9a2e,
    cx: 1000,
    cy: 262,
    zoom: 7,
    rotation: 17,
    shade: 0.7,
  },
  {
    tag: "MOSS",
    plate: 0x3fa37a,
    letters: 0x0e2a1d,
    cx: 700,
    cy: 360,
    zoom: 7,
    rotation: 9,
    shade: 0.7,
  },
  {
    tag: "VOID",
    plate: 0x2a2340,
    letters: 0xc9a6ff,
    letterFade: 0x6ee7ff,
    cx: 826,
    cy: 300,
    zoom: 7,
    rotation: -8,
    shade: 0.7,
  },
  {
    tag: "SNOW",
    plate: 0xbcc8cb,
    letters: 0x24323a,
    plateFade: 0xf2f6f7,
    cx: 1080,
    cy: 340,
    zoom: 6,
    rotation: -12,
    shade: 0.7,
  },
  {
    tag: "RAIL",
    plate: 0x2d5b8a,
    letters: 0xffe49a,
    cx: 694,
    cy: 452,
    zoom: 9,
    rotation: -18,
    shade: 0.85,
  },
  {
    tag: "ZINC",
    plate: 0xbcc8cb,
    letters: 0x24323a,
    cx: 1112,
    cy: 470,
    zoom: 9,
    rotation: 14,
    shade: 0.85,
  },
  {
    tag: "GEAR",
    plate: 0xc96a3d,
    letters: 0xfff0dc,
    plateFade: 0xd9a441,
    cx: 944,
    cy: 400,
    zoom: 8,
    rotation: 6,
    shade: 0.85,
  },
  {
    tag: "BOOM",
    plate: 0xb5302a,
    letters: 0xffffff,
    letterFade: 0xffd23f,
    cx: 676,
    cy: 590,
    zoom: 10,
    rotation: 12,
  },
  {
    tag: "SAIL",
    plate: 0x2a2340,
    letters: 0xffffff,
    plateFade: 0x2d5b8a,
    letterFade: 0x6ee7ff,
    cx: 1066,
    cy: 588,
    zoom: 10,
    rotation: 4,
  },
  {
    tag: "CRTN",
    plate: 0xd9a441,
    letters: 0x3b230e,
    cx: 880,
    cy: 520,
    zoom: 12,
    rotation: -4,
  },
];

type Bitmap = { width: number; height: number; data: Uint8ClampedArray };
type Glyph = { bitmap: Bitmap; x: number; color: number };
type PlateSheets = { riveted: Bitmap; letters: Bitmap };

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

function plateGlyphs(design: PlateDesign, sheets: PlateSheets): Glyph[] {
  const { riveted, letters } = sheets;
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

// The game's text pass: every shadow of the line first, then the glyphs, with
// the colour applied as a multiply tint. Scaled up by whole pixels so the
// later rotation resamples crisp texels instead of a 32x9 bitmap.
function plateCanvas(
  design: PlateDesign,
  sheets: PlateSheets,
  zoom: number,
): Canvas {
  const glyphs = plateGlyphs(design, sheets);
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

  const texels = createCanvas(width, height);
  const tctx = texels.getContext("2d");
  const image = tctx.createImageData(width, height);
  image.data.set(out);
  tctx.putImageData(image, 0, 0);

  const scaled = createCanvas(width * zoom, height * zoom);
  const sctx = scaled.getContext("2d");
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(texels, 0, 0, width * zoom, height * zoom);
  return scaled;
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

function paintPileLight(ctx: SKRSContext2D): void {
  paintEllipseGradient(ctx, 920, 400, 400, 300, [
    [0, "rgba(255,200,110,0.16)"],
    [0.6, "rgba(255,200,110,0.05)"],
    [1, "rgba(255,200,110,0)"],
  ]);
}

async function paintPile(ctx: SKRSContext2D): Promise<void> {
  const sheets = {
    riveted: await loadBitmap("plate_riveted.png"),
    letters: await loadBitmap("plate_letters.png"),
  };

  for (const spec of PILE) {
    const plate = plateCanvas(
      {
        style: "riveted",
        tag: spec.tag,
        plate: spec.plate,
        letters: spec.letters,
        plateFade: spec.plateFade ?? null,
        letterFade: spec.letterFade ?? null,
      },
      sheets,
      spec.zoom,
    );

    const image =
      spec.shade === undefined ? plate : shadedPlate(plate, spec.shade);

    ctx.save();
    ctx.translate(spec.cx, spec.cy);
    ctx.rotate((spec.rotation * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = spec.zoom * 2.2;
    ctx.shadowOffsetY = spec.zoom * 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
  }
}

// Darkens only the plate's own pixels so the back of the pile recedes into
// the night backdrop.
function shadedPlate(plate: Canvas, shade: number): Canvas {
  const shaded = createCanvas(plate.width, plate.height);
  const sctx = shaded.getContext("2d");
  sctx.drawImage(plate, 0, 0);
  sctx.globalCompositeOperation = "source-atop";
  sctx.fillStyle = `rgba(11,11,14,${1 - shade})`;
  sctx.fillRect(0, 0, plate.width, plate.height);
  return shaded;
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
    paintPileLight(ctx);
    await paintPile(ctx);
    await paintCopy(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
