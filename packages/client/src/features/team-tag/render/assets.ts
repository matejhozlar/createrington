import type { PlateColumn } from "@createrington/shared/team-tag";
import { loadImage } from "@/lib/skin-runner/skin";
import { STEVE_SKIN_DATA_URI } from "@/lib/skin-runner/steve";

export type Bitmap = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type Glyph = {
  bitmap: Bitmap;
  advance: number;
};

export type PlateAssets = {
  vanilla: Map<string, Glyph>;
  plateColumns: Record<PlateColumn, Glyph>;
  plateLetters: Map<string, Glyph>;
  pings: Bitmap[];
  steveHead: Bitmap;
  logo: HTMLImageElement;
  logoShadow: HTMLCanvasElement;
};

const ROOT = "/assets/team-tag";
const PLATE_LETTER_ROWS = ["ABCDEFGHIJKLMNOPQR", "STUVWXYZ0123456789"];
const PLATE_COLUMNS: PlateColumn[] = ["edge", "rivet", "fill"];
const VANILLA_SPACE_ADVANCE = 4;
const PING_LEVELS = 5;
export const HEAD_SIZE = 8;
const SKIN_FACE = { x: 8, y: 8 };
const SKIN_HAT = { x: 40, y: 8 };
export const SHADOW_DIM = 0.25;

export function bitmapOf(
  image: CanvasImageSource & { width: number; height: number },
): Bitmap {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  return { width: image.width, height: image.height, data };
}

export function cropBitmap(
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

export function headOf(source: Bitmap): Bitmap {
  if (source.width === HEAD_SIZE && source.height === HEAD_SIZE) return source;
  const head = cropBitmap(
    source,
    SKIN_FACE.x,
    SKIN_FACE.y,
    HEAD_SIZE,
    HEAD_SIZE,
  );
  const hat = cropBitmap(source, SKIN_HAT.x, SKIN_HAT.y, HEAD_SIZE, HEAD_SIZE);
  for (let i = 0; i < head.data.length; i += 4) {
    const alpha = hat.data[i + 3] / 255;
    if (alpha === 0) continue;
    for (let c = 0; c < 3; c++) {
      head.data[i + c] =
        hat.data[i + c] * alpha + head.data[i + c] * (1 - alpha);
    }
    head.data[i + 3] = Math.max(head.data[i + 3], hat.data[i + 3]);
  }
  return head;
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

function glyphSheet(
  sheet: Bitmap,
  rows: string[],
  cellWidth: number,
  cellHeight: number,
): Map<string, Glyph> {
  const glyphs = new Map<string, Glyph>();
  rows.forEach((chars, row) => {
    [...chars].forEach((char, col) => {
      const bitmap = cropBitmap(
        sheet,
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
      );
      glyphs.set(char, { bitmap, advance: glyphWidth(bitmap) + 1 });
    });
  });
  return glyphs;
}

function vanillaGlyphs(sheet: Bitmap): Map<string, Glyph> {
  const rows = Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) =>
      String.fromCharCode(32 + row * 16 + col),
    ).join(""),
  );
  const cell = sheet.width / 16;
  const glyphs = glyphSheet(
    cropBitmap(sheet, 0, cell * 2, sheet.width, cell * 6),
    rows,
    cell,
    cell,
  );
  glyphs.set(" ", {
    bitmap: { width: 0, height: 0, data: new Uint8ClampedArray() },
    advance: VANILLA_SPACE_ADVANCE,
  });
  return glyphs;
}

function shadowCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const bitmap = bitmapOf(image);
  for (let i = 0; i < bitmap.data.length; i += 4) {
    bitmap.data[i] *= SHADOW_DIM;
    bitmap.data[i + 1] *= SHADOW_DIM;
    bitmap.data[i + 2] *= SHADOW_DIM;
  }
  return bitmapCanvas(bitmap);
}

export function bitmapCanvas(bitmap: Bitmap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(
        new Uint8ClampedArray(bitmap.data),
        bitmap.width,
        bitmap.height,
      ),
      0,
      0,
    );
  return canvas;
}

export async function loadPlateAssets(): Promise<PlateAssets> {
  const [ascii, riveted, letters, logo, pings, steve] = await Promise.all([
    loadImage(`${ROOT}/ascii.png`),
    loadImage(`${ROOT}/plate_riveted.png`),
    loadImage(`${ROOT}/plate_letters.png`),
    loadImage(`${ROOT}/logo.png`),
    Promise.all(
      Array.from({ length: PING_LEVELS }, (_, i) =>
        loadImage(`${ROOT}/ping_${i + 1}.png`),
      ),
    ),
    loadImage(STEVE_SKIN_DATA_URI),
  ]);

  const columnSheet = glyphSheet(bitmapOf(riveted), ["abc"], 1, riveted.height);
  const plateColumns = Object.fromEntries(
    PLATE_COLUMNS.map((column, i) => [column, columnSheet.get("abc"[i])!]),
  ) as Record<PlateColumn, Glyph>;

  return {
    vanilla: vanillaGlyphs(bitmapOf(ascii)),
    plateColumns,
    plateLetters: glyphSheet(
      bitmapOf(letters),
      PLATE_LETTER_ROWS,
      letters.width / PLATE_LETTER_ROWS[0].length,
      letters.height / PLATE_LETTER_ROWS.length,
    ),
    pings: pings.map(bitmapOf),
    steveHead: headOf(bitmapOf(steve)),
    logo,
    logoShadow: shadowCanvas(logo),
  };
}
