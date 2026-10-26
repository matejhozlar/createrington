import {
  PLATE_WIDTH,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import type { Bitmap, PlateAssets } from "./assets";
import { Framebuffer, sizeCanvas } from "./framebuffer";
import { tabNameLine } from "./text";

export type TabRow = {
  name: string;
  nameColor: number;
  skin: Bitmap;
  pingMs: number;
  design: PlateDesign | null;
};

const LIST_TOP = 10;
const ROW_STEP = 9;
const ROW_HEIGHT = 8;
const HEAD_ADVANCE = 9;
const PING_SPACE = 13;
const PING_WIDTH = 10;
const PING_HEIGHT = 8;
const LIST_BACKGROUND = 0x80000000;
const ROW_BACKGROUND = 0x20ffffff;
const SIDE_MARGIN = 14;
const BOTTOM_MARGIN = 12;
const HEADER_LINES = 5;
const LOGO_WIDTH = 159;
const LOGO_HEIGHT = 44;
const LOGO_LINE_WIDTH = 160;
const SCREEN_HEIGHT = 1080;

function pingLevel(ms: number): number {
  if (ms < 150) return 4;
  if (ms < 300) return 3;
  if (ms < 600) return 2;
  if (ms < 1000) return 1;
  return 0;
}

function drawHead(fb: Framebuffer, skin: Bitmap, x: number, y: number) {
  fb.blit(skin, 8, 8, 8, 8, x, y);
  fb.blit(skin, 40, 8, 8, 8, x, y);
}

const backdropCache = new WeakMap<
  HTMLImageElement,
  { width: number; height: number; canvas: HTMLCanvasElement }
>();

function backdropLayer(
  image: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const cached = backdropCache.get(image);
  if (cached && cached.width === width && cached.height === height) {
    return cached.canvas;
  }
  const texelsPerPixel = Math.min(
    image.height / SCREEN_HEIGHT,
    image.width / width,
    image.height / height,
  );
  const sw = width * texelsPerPixel;
  const sh = height * texelsPerPixel;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      (image.width - sw) / 2,
      0,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );
  }
  backdropCache.set(image, { width, height, canvas });
  return canvas;
}

export function renderTabList(
  canvas: HTMLCanvasElement,
  {
    rows,
    guiScale,
    backdrop,
    assets,
    minCssWidth,
  }: {
    rows: TabRow[];
    guiScale: number;
    backdrop: HTMLImageElement | null;
    assets: PlateAssets;
    minCssWidth: number;
  },
) {
  const lines = rows.map((row) =>
    tabNameLine(row.name, row.nameColor, row.design, assets),
  );
  const nameWidth = Math.max(0, ...lines.map((line) => line.width));
  const rowWidth = HEAD_ADVANCE + nameWidth + PING_SPACE;
  const listWidth = Math.max(rowWidth, LOGO_LINE_WIDTH);
  const dpr = window.devicePixelRatio || 1;
  const screenWidth = Math.max(
    listWidth + 2 + SIDE_MARGIN * 2,
    Math.floor((minCssWidth * dpr) / guiScale),
  );
  const centre = Math.floor(screenWidth / 2);
  const half = Math.floor(listWidth / 2);

  const headerTop = LIST_TOP;
  const headerBottom = headerTop + HEADER_LINES * ROW_STEP;
  const rowsTop = headerBottom + 1;
  const rowsBottom = rowsTop + rows.length * ROW_STEP;
  const screenHeight = rowsBottom + BOTTOM_MARGIN;

  const fb = new Framebuffer(screenWidth, screenHeight);
  fb.fill(
    centre - half - 1,
    headerTop - 1,
    centre + half + 1,
    headerBottom,
    LIST_BACKGROUND,
  );
  fb.fill(
    centre - half - 1,
    rowsTop - 1,
    centre + half + 1,
    rowsBottom,
    LIST_BACKGROUND,
  );

  const rowX = centre - Math.floor(rowWidth / 2);
  rows.forEach((row, i) => {
    const y = rowsTop + i * ROW_STEP;
    fb.fill(rowX, y, rowX + rowWidth, y + ROW_HEIGHT, ROW_BACKGROUND);
    drawHead(fb, row.skin, rowX, y);
    fb.text(lines[i].ops, rowX + HEAD_ADVANCE, y);
    fb.blit(
      assets.pings[pingLevel(row.pingMs)],
      0,
      0,
      PING_WIDTH,
      PING_HEIGHT,
      rowX + rowWidth - 11,
      y,
    );
  });

  const ctx = sizeCanvas(
    canvas,
    (screenWidth * guiScale) / dpr,
    (screenHeight * guiScale) / dpr,
    dpr,
  );
  if (!ctx) return;
  const width = screenWidth * guiScale;
  const height = screenHeight * guiScale;
  if (backdrop) {
    ctx.drawImage(backdropLayer(backdrop, width, height), 0, 0);
  } else {
    ctx.fillStyle = "#16151a";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(fb.toCanvas(), 0, 0, width, height);

  const logoX = centre - LOGO_LINE_WIDTH / 2;
  const drawLogo = (image: CanvasImageSource, offset: number) =>
    ctx.drawImage(
      image,
      (logoX + offset) * guiScale,
      (headerTop + offset) * guiScale,
      LOGO_WIDTH * guiScale,
      LOGO_HEIGHT * guiScale,
    );
  drawLogo(assets.logoShadow, 1);
  drawLogo(assets.logo, 0);
}

export function renderPlateStrip(
  canvas: HTMLCanvasElement,
  {
    design,
    name,
    nameColor,
    skin,
    zoom,
    assets,
  }: {
    design: PlateDesign;
    name?: string;
    nameColor?: number;
    skin?: Bitmap;
    zoom: number;
    assets: PlateAssets;
  },
) {
  const pad = 2;
  const head = skin ? HEAD_ADVANCE : 0;
  const line = tabNameLine(name ?? "", nameColor ?? 0xffffff, design, assets);
  const width = pad * 2 + head + (name ? line.width : PLATE_WIDTH + 1);
  const height = pad * 2 + ROW_HEIGHT + 1;
  const fb = new Framebuffer(width, height);
  fb.fill(0, 0, width, height, 0xff1b1a1f);
  fb.fill(0, pad, width, pad + ROW_HEIGHT, ROW_BACKGROUND);
  if (skin) drawHead(fb, skin, pad, pad);
  fb.text(line.ops, pad + head, pad);

  const dpr = window.devicePixelRatio || 1;
  const pixels = Math.max(1, Math.round(zoom * dpr));
  const ctx = sizeCanvas(
    canvas,
    (width * pixels) / dpr,
    (height * pixels) / dpr,
    dpr,
  );
  ctx?.drawImage(fb.toCanvas(), 0, 0, width * pixels, height * pixels);
}
