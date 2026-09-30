// Headless tool: renders the Windows installer art for the Createrington
// Launcher (NSIS, Modern UI 2): installer.ico, installer-sidebar.bmp and
// installer-header.bmp, plus a high-res PNG master of each under masters/.
//
// The sidebar figures come from the shared posed-figure cache (see
// og-shared.ts); a missing entry needs SKIN_API_KEY in the environment once.
//
// Run: pnpm --filter @createrington/server util:render-installer-assets [outDir]
// (outDir defaults to tmp/launcher-installer at the repo root)

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCanvas,
  loadImage,
  type Canvas,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import { computeBBox } from "@/utils/canvas";
import { drawImageCover } from "@/utils/og-card";
import { ASSETS, getPoseFigure } from "./og-shared";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, "..", "..", "..", "..", "..");

const SUPERSAMPLE = 4;
const MASTER_SCALE = 4;

const SIDEBAR = { w: 164, h: 314 } as const;
const HEADER = { w: 150, h: 57 } as const;

const ICON_SIZES = [256, 64, 48, 32, 24, 16] as const;

const BACKGROUND = "#0b0b0e";
const BACKDROP = join(ASSETS, "hero", "dark-warehouse.webp");
const LOGO = join(ASSETS, "logo", "logo.png");
const WORDMARK = join(here, "assets", "launcher", "createrington-launcher.png");

type Row = "back" | "middle" | "front";

const ROWS: Record<
  Row,
  {
    groundY: number;
    height: number;
    shadeTop: number;
    shadeBottom: number;
    blur: number;
  }
> = {
  back: {
    groundY: 160,
    height: 86,
    shadeTop: 0.55,
    shadeBottom: 0.8,
    blur: 0.25,
  },
  middle: {
    groundY: 220,
    height: 108,
    shadeTop: 0.3,
    shadeBottom: 0.65,
    blur: 0.1,
  },
  front: {
    groundY: 292,
    height: 136,
    shadeTop: 0.05,
    shadeBottom: 0.5,
    blur: 0,
  },
};

const ROW_ORDER: readonly Row[] = ["back", "middle", "front"];

interface Admin {
  username: string;
  uuid: string;
  pose: string;
  row: Row;
  centerX: number;
  mirror?: boolean;
}

const ADMINS: readonly Admin[] = [
  {
    username: "diablothe2nd",
    uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f",
    pose: "gaze",
    row: "back",
    centerX: 50,
  },
  {
    username: "Tetsuoken",
    uuid: "32ff995f-cf92-417b-b745-891738346120",
    pose: "ponder",
    row: "back",
    centerX: 116,
    mirror: true,
  },
  {
    username: "Cailin05",
    uuid: "aee71815-6420-444c-a245-9047c41f4a39",
    pose: "engineer",
    row: "middle",
    centerX: 32,
  },
  {
    username: "The_BigShot",
    uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
    pose: "crossed",
    row: "middle",
    centerX: 132,
    mirror: true,
  },
  {
    username: "saunhardy",
    uuid: "091b900c-4174-478c-900c-a0fe5a31a329",
    pose: "confidence",
    row: "front",
    centerX: 68,
  },
  {
    username: "Agent772",
    uuid: "3e0db446-147a-4692-87fd-c3facc4341db",
    pose: "relaxed",
    row: "front",
    centerX: 122,
    mirror: true,
  },
];

type Paint = (ctx: SKRSContext2D, device: number) => Promise<void> | void;
type IconPaint = (ctx: SKRSContext2D, size: number) => void;

function shrink(src: Canvas, w: number, h: number): Canvas {
  let current = src;
  while (current.width / 2 >= w && current.height / 2 >= h) {
    const half = createCanvas(
      Math.round(current.width / 2),
      Math.round(current.height / 2),
    );
    const hctx = half.getContext("2d");
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  if (current.width === w && current.height === h) return current;
  const out = createCanvas(w, h);
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(current, 0, 0, w, h);
  return out;
}

async function render(
  w: number,
  h: number,
  scale: number,
  paint: Paint,
): Promise<Canvas> {
  const device = scale * SUPERSAMPLE;
  const canvas = createCanvas(w * device, h * device);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.scale(device, device);
  await paint(ctx, device);
  return shrink(canvas, w * scale, h * scale);
}

function encodeBmp24(canvas: Canvas, background: string): Buffer {
  const { width: w, height: h } = canvas;
  const flat = createCanvas(w, h);
  const fctx = flat.getContext("2d");
  fctx.fillStyle = background;
  fctx.fillRect(0, 0, w, h);
  fctx.drawImage(canvas, 0, 0);
  const { data } = fctx.getImageData(0, 0, w, h);

  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelBytes = rowSize * h;
  const buf = Buffer.alloc(54 + pixelBytes);
  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(54 + pixelBytes, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelBytes, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);

  for (let y = 0; y < h; y++) {
    const row = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      buf[row + x * 3] = data[i + 2];
      buf[row + x * 3 + 1] = data[i + 1];
      buf[row + x * 3 + 2] = data[i];
    }
  }
  return buf;
}

function encodeIconDib(canvas: Canvas): Buffer {
  const { width: w, height: h } = canvas;
  const { data } = canvas.getContext("2d").getImageData(0, 0, w, h);
  const maskRow = Math.ceil(w / 32) * 4;
  const buf = Buffer.alloc(40 + w * h * 4 + maskRow * h);
  buf.writeUInt32LE(40, 0);
  buf.writeInt32LE(w, 4);
  buf.writeInt32LE(h * 2, 8);
  buf.writeUInt16LE(1, 12);
  buf.writeUInt16LE(32, 14);
  buf.writeUInt32LE(0, 16);
  buf.writeUInt32LE(w * h * 4 + maskRow * h, 20);

  for (let y = 0; y < h; y++) {
    const row = 40 + (h - 1 - y) * w * 4;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      buf[row + x * 4] = data[i + 2];
      buf[row + x * 4 + 1] = data[i + 1];
      buf[row + x * 4 + 2] = data[i];
      buf[row + x * 4 + 3] = data[i + 3];
    }
  }
  return buf;
}

function encodeIco(frames: Canvas[]): Buffer {
  const images = frames.map((f) =>
    f.width >= 256 ? f.toBuffer("image/png") : encodeIconDib(f),
  );
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let offset = header.length;
  frames.forEach((frame, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(frame.width >= 256 ? 0 : frame.width, entry);
    header.writeUInt8(frame.height >= 256 ? 0 : frame.height, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

function logoPainter(logo: Image): IconPaint {
  return (ctx, size) => {
    ctx.drawImage(logo, 0, 0, size, size);
  };
}

function renderIcon(size: number, paint: IconPaint): Promise<Canvas> {
  return render(size, size, 1, (ctx) => paint(ctx, size));
}

interface PosedAdmin extends Admin {
  img: Image;
}

function paintRoom(ctx: SKRSContext2D, device: number, backdrop: Image): void {
  const { w, h } = SIDEBAR;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, w, h);

  const bleed = 8;
  ctx.save();
  ctx.filter = `blur(${0.8 * device}px) brightness(0.7) saturate(0.7)`;
  drawImageCover(
    ctx,
    backdrop,
    -bleed,
    -bleed,
    w + bleed * 2,
    h + bleed * 2,
    "center",
  );
  ctx.restore();

  const top = ctx.createLinearGradient(0, 0, 0, h);
  top.addColorStop(0, BACKGROUND);
  top.addColorStop(0.2, "rgba(11,11,14,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);

  const cone = ctx.createRadialGradient(w / 2, -40, 0, w / 2, -40, 300);
  cone.addColorStop(0, "rgba(200,205,225,0.13)");
  cone.addColorStop(0.45, "rgba(190,195,215,0.04)");
  cone.addColorStop(1, "rgba(190,195,215,0)");
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, 236);
  ctx.scale(1, 0.32);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
  pool.addColorStop(0, "rgba(200,205,225,0.06)");
  pool.addColorStop(1, "rgba(200,205,225,0)");
  ctx.fillStyle = pool;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  ctx.restore();
}

function paintAdmin(
  ctx: SKRSContext2D,
  device: number,
  admin: PosedAdmin,
  refHeight: number,
): void {
  const row = ROWS[admin.row];
  const bbox = computeBBox(admin.img);
  if (!bbox) throw new Error(`Empty figure render for ${admin.username}`);
  const scale = row.height / refHeight;
  const fw = bbox.width * scale;
  const fh = bbox.height * scale;
  const x = admin.centerX - fw / 2;
  const y = row.groundY - fh;

  ctx.save();
  ctx.filter = `blur(${3 * device}px)`;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.ellipse(
    admin.centerX,
    row.groundY - 1,
    fw * 0.45,
    fh * 0.035,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  const layer = createCanvas(Math.ceil(fw * device), Math.ceil(fh * device));
  const lctx = layer.getContext("2d");
  lctx.imageSmoothingQuality = "high";
  if (admin.mirror) {
    lctx.translate(layer.width, 0);
    lctx.scale(-1, 1);
  }
  lctx.drawImage(
    admin.img,
    bbox.minX,
    bbox.minY,
    bbox.width,
    bbox.height,
    0,
    0,
    layer.width,
    layer.height,
  );
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  const shade = lctx.createLinearGradient(0, 0, 0, layer.height);
  shade.addColorStop(0, `rgba(8,8,11,${row.shadeTop})`);
  shade.addColorStop(1, `rgba(8,8,11,${row.shadeBottom})`);
  lctx.globalCompositeOperation = "source-atop";
  lctx.fillStyle = shade;
  lctx.fillRect(0, 0, layer.width, layer.height);

  ctx.save();
  if (row.blur > 0) ctx.filter = `blur(${row.blur * device}px)`;
  ctx.drawImage(layer, x, y, fw, fh);
  ctx.restore();
}

function paintVignette(ctx: SKRSContext2D): void {
  const { w, h } = SIDEBAR;
  const edge = ctx.createRadialGradient(
    w / 2,
    h * 0.45,
    h * 0.2,
    w / 2,
    h * 0.45,
    h * 0.7,
  );
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  const floor = ctx.createLinearGradient(0, h, 0, h * 0.8);
  floor.addColorStop(0, "rgba(11,11,14,0.85)");
  floor.addColorStop(1, "rgba(11,11,14,0)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, w, h);
}

function paintWordmark(
  ctx: SKRSContext2D,
  device: number,
  wordmark: Image,
): void {
  const w = 148;
  const h = (w * wordmark.height) / wordmark.width;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 10 * device;
  ctx.shadowOffsetY = 3 * device;
  ctx.drawImage(wordmark, (SIDEBAR.w - w) / 2, 26, w, h);
  ctx.restore();
}

function paintSidebar(
  ctx: SKRSContext2D,
  device: number,
  admins: readonly PosedAdmin[],
  backdrop: Image,
  wordmark: Image,
): void {
  paintRoom(ctx, device, backdrop);
  paintWordmark(ctx, device, wordmark);
  const refHeight = Math.max(
    ...admins.map((a) => computeBBox(a.img)?.height ?? 0),
  );
  for (const row of ROW_ORDER) {
    for (const admin of admins.filter((a) => a.row === row)) {
      paintAdmin(ctx, device, admin, refHeight);
    }
  }
  paintVignette(ctx);
}

function paintHeader(ctx: SKRSContext2D, device: number, logo: Image): void {
  const { w, h } = HEADER;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const d = 43;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 3 * device;
  ctx.shadowOffsetY = 1 * device;
  ctx.drawImage(logo, w / 2 - d / 2, (h - d) / 2 - 0.5, d, d);
  ctx.restore();
}

async function main(): Promise<void> {
  const outDir =
    process.argv[2] ?? join(REPO_ROOT, "tmp", "launcher-installer");
  const masters = join(outDir, "masters");
  await mkdir(masters, { recursive: true });

  const [logo, wordmark, backdrop, admins] = await Promise.all([
    loadImage(LOGO),
    loadImage(WORDMARK),
    loadImage(BACKDROP),
    Promise.all(
      ADMINS.map(async (admin) => ({
        ...admin,
        img: await getPoseFigure({ ...admin, style: "cel", outline: false }),
      })),
    ),
  ]);

  const icon = logoPainter(logo);
  const frames = await Promise.all(ICON_SIZES.map((s) => renderIcon(s, icon)));
  await writeFile(join(outDir, "installer.ico"), encodeIco(frames));
  await Promise.all(
    frames.map((f) =>
      writeFile(join(masters, `icon-${f.width}.png`), f.toBuffer("image/png")),
    ),
  );
  const iconMaster = await renderIcon(logo.width, icon);
  await writeFile(
    join(masters, "installer-icon.png"),
    iconMaster.toBuffer("image/png"),
  );

  const sidebarPaint: Paint = (ctx, device) =>
    paintSidebar(ctx, device, admins, backdrop, wordmark);
  const headerPaint: Paint = (ctx, device) => paintHeader(ctx, device, logo);

  for (const [name, size, paint, bmpBg] of [
    ["installer-sidebar", SIDEBAR, sidebarPaint, BACKGROUND],
    ["installer-header", HEADER, headerPaint, "#ffffff"],
  ] as const) {
    const target = await render(size.w, size.h, 1, paint);
    await writeFile(join(outDir, `${name}.bmp`), encodeBmp24(target, bmpBg));
    const master = await render(size.w, size.h, MASTER_SCALE, paint);
    await writeFile(
      join(masters, `${name}@${MASTER_SCALE}x.png`),
      master.toBuffer("image/png"),
    );
  }

  console.log(`wrote installer assets to ${outDir}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
