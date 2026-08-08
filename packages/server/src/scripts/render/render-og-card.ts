// Headless tool: composites the social / link-preview card (og-card.png) for
// the Createrington client SPA. Brand assets are read from the client's public
// assets and the repo-root screenshots/ folder; the Outfit webfont lives in
// the shared server assets (src/assets/fonts).
//
// Team figures are rendered once via the skin-api and cached under assets/team/
// (committed), so regenerating the card stays offline. To refresh them after a
// skin change, delete assets/team/ and re-run with the skin-api key in the
// environment:
//   infisical run --env=dev -- pnpm --filter @createrington/server util:render-og-card
//
// Run: pnpm --filter @createrington/server util:render-og-card [outPath]

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// @napi-rs/canvas rather than the server's node-canvas: its GlobalFonts loads
// the vendored .woff2 fonts, which node-canvas's registerFont cannot read.
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";

const W = 1200;
const H = 630;
// Render at 2x then downscale so gradients, screenshot edges, and text stay
// crisp.
const SUPERSAMPLE = 2;

// Brand tokens (client theme.css OkLCH values converted to sRGB).
const BG_TOP = "#17171d";
const BG_BOT = "#0b0b0e";
const CARD = "#18181d";
const AMBER = "#ffb900";
const FOREGROUND = "#fafafb";
const MUTED = "#a0a0a5";

const TEXT_X = 74;

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, "..", "..", "..", "..", "client", "public");
const ASSETS = join(PUBLIC, "assets");
const REPO_ROOT = join(here, "..", "..", "..", "..", "..");
const SHOTS = join(REPO_ROOT, "screenshots");
const FONTS = join(here, "..", "..", "assets", "fonts");
const TEAM_DIR = join(here, "assets", "team");

interface FrameSpec {
  file: string;
  url: string;
  centerX: number;
  centerY: number;
  width: number;
  angle: number;
  z: number;
}

// A diagonal cascade of browser windows, mirroring the marketing WebShowcase
// scene: feature screens (not the home page, whose hero would duplicate the
// woodmark + tagline drawn on the left).
const FRAMES: readonly FrameSpec[] = [
  {
    file: join(SHOTS, "web-chat.webp"),
    url: "createrington.com/chat",
    centerX: 900,
    centerY: 162,
    width: 470,
    angle: -7,
    z: 1,
  },
  {
    file: join(SHOTS, "online-players.webp"),
    url: "createrington.com/players",
    centerX: 1064,
    centerY: 320,
    width: 486,
    angle: -7,
    z: 2,
  },
  {
    file: join(SHOTS, "crypto-chart.webp"),
    url: "createrington.com/crypto",
    centerX: 908,
    centerY: 466,
    width: 520,
    angle: -7,
    z: 3,
  },
];

interface TeamMember {
  username: string;
  uuid: string;
  pose: string;
}

// Rendered as a small lineup under the link. Poses are skin-api poses chosen
// to read as a tidy standing row.
const TEAM: readonly TeamMember[] = [
  {
    username: "saunhardy",
    uuid: "091b900c-4174-478c-900c-a0fe5a31a329",
    pose: "confidence",
  },
  {
    username: "Agent772",
    uuid: "3e0db446-147a-4692-87fd-c3facc4341db",
    pose: "point",
  },
  {
    username: "The_BigShot",
    uuid: "4cada83a-c012-4a31-8d80-942f3f79e8a1",
    pose: "gaze",
  },
  {
    username: "diablothe2nd",
    uuid: "8cca5cab-b782-452b-a8b9-8bb4ae0f6d0f",
    pose: "wave",
  },
  {
    username: "Tetsuoken",
    uuid: "32ff995f-cf92-417b-b745-891738346120",
    pose: "relaxed",
  },
  {
    username: "Cailin05",
    uuid: "aee71815-6420-444c-a245-9047c41f4a39",
    pose: "ponder",
  },
];

interface BBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

// Tight alpha bounding box so each posed figure can be scaled by its true
// silhouette height and bottom-aligned to a shared ground line regardless of
// the transparent padding around it.
function computeBBox(img: Image): BBox {
  const probe = createCanvas(img.width, img.height);
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 0, 0);
  const { data } = pctx.getImageData(0, 0, img.width, img.height);
  let minX = img.width;
  let minY = img.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3]! > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Resolve a team figure PNG: prefer the committed cache, otherwise render it
// via the skin-api and cache it so later card renders stay offline. Calls the
// HTTP endpoint directly rather than via the SDK because the SDK does not
// forward the `outline` option, which gives the figures the white edge that
// reads against the dark card.
async function getTeamFigure(m: TeamMember): Promise<Image> {
  const file = join(TEAM_DIR, `${m.username}.png`);
  if (!existsSync(file)) {
    const apiKey = process.env.SKIN_API_KEY;
    if (!apiKey) {
      throw new Error(
        `Missing cached team figure (${file}) and SKIN_API_KEY is not set. ` +
          `Run once with the skin-api key to populate the cache, e.g.: ` +
          `infisical run --env=dev -- pnpm --filter @createrington/server util:render-og-card`,
      );
    }
    // Defaults to the public skin-api so the script runs without env setup;
    // dev/infisical runs override via SKIN_API_URL.
    const baseUrl = process.env.SKIN_API_URL ?? "https://api.createrington.com";
    const query = new URLSearchParams({
      pose: m.pose,
      width: "300",
      height: "450",
      outline: "true",
    });
    const res = await fetch(`${baseUrl}/v1/render?${query}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "createrington-app/og-card",
      },
      body: JSON.stringify({ uuid: m.uuid }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `skin-api render failed for ${m.username} (${res.status}): ${detail}`,
      );
    }
    const png = Buffer.from(await res.arrayBuffer());
    await mkdir(TEAM_DIR, { recursive: true });
    await writeFile(file, png);
  }
  return loadImage(await readFile(file));
}

function roundRectPath(
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

// object-fit: cover, anchored to the top-left of the source (so the sidebar
// and primary content read), clipped by the current path.
function drawImageCoverTopLeft(
  ctx: SKRSContext2D,
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

function paintBackground(ctx: SKRSContext2D): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOT);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const sheen = ctx.createLinearGradient(0, 0, 0, 170);
  sheen.addColorStop(0, "rgba(255,255,255,0.035)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, 170);

  const pool = ctx.createRadialGradient(905, 320, 30, 905, 320, 540);
  pool.addColorStop(0, "rgba(255,185,0,0.20)");
  pool.addColorStop(0.45, "rgba(255,150,0,0.09)");
  pool.addColorStop(1, "rgba(255,150,0,0)");
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, W, H);
}

function drawBrowserFrame(
  ctx: SKRSContext2D,
  img: Image,
  spec: FrameSpec,
): void {
  const w = spec.width;
  const chromeH = Math.round(w * 0.072);
  const bodyH = Math.round(w * 0.5625);
  const h = chromeH + bodyH;
  const r = 15;

  ctx.save();
  ctx.translate(spec.centerX, spec.centerY);
  ctx.rotate((spec.angle * Math.PI) / 180);
  const x = -w / 2;
  const y = -h / 2;

  // Drop shadow.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 26;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  // Amber rim glow.
  ctx.save();
  ctx.shadowColor = "rgba(255,185,0,0.45)";
  ctx.shadowBlur = 32;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  // Window body clip.
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  // Chrome bar.
  ctx.fillStyle = CARD;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x, y, w, chromeH);

  const dotR = Math.max(3, chromeH * 0.15);
  const dotY = y + chromeH / 2;
  const dotX = x + chromeH * 0.62;
  const dotGap = dotR * 3.1;
  const dots = ["#ff5f57", "#febc2e", "#28c840"];
  dots.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(dotX + i * dotGap, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });

  // URL pill.
  const pillX = dotX + 3 * dotGap;
  const pillH = chromeH * 0.56;
  const pillY = y + (chromeH - pillH) / 2;
  const pillW = Math.min(w - (pillX - x) - chromeH * 0.5, w * 0.62);
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(chromeH * 0.34)}px Outfit`;
  ctx.textBaseline = "middle";
  ctx.fillText(spec.url, pillX + pillH * 0.5, dotY + 1);

  // Screenshot.
  ctx.save();
  roundRectPath(ctx, x, y + chromeH, w, bodyH, 0);
  ctx.clip();
  drawImageCoverTopLeft(ctx, img, x, y + chromeH, w, bodyH);
  ctx.restore();

  ctx.restore(); // body clip

  // Edges.
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r - 1);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

async function paintFrames(ctx: SKRSContext2D): Promise<void> {
  const loaded = await Promise.all(
    FRAMES.map(async (spec) => ({ spec, img: await loadImage(spec.file) })),
  );
  loaded.sort((a, b) => a.spec.z - b.spec.z);
  for (const { spec, img } of loaded) drawBrowserFrame(ctx, img, spec);
}

// Largest size from the descending list whose rendered width fits maxWidth.
function fitFontSize(
  ctx: SKRSContext2D,
  text: string,
  font: (size: number) => string,
  sizes: readonly number[],
  maxWidth: number,
): number {
  for (const size of sizes) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return sizes[sizes.length - 1]!;
}

async function paintText(ctx: SKRSContext2D): Promise<void> {
  const wood = await loadImage(
    join(ASSETS, "logo", "cogs-and-steam-logo.webp"),
  );
  const woodW = 388;
  const woodH = (woodW * wood.height) / wood.width;
  ctx.drawImage(wood, TEXT_X, 50, woodW, woodH);

  const maxTextWidth = 452;
  ctx.textBaseline = "alphabetic";

  // Tagline, amber accent on the punch word of each line (mirrors the home
  // page hero).
  const tagFont = (s: number) => `700 ${s}px Outfit`;
  const tagSize = fitFontSize(
    ctx,
    "Automate Everything.",
    tagFont,
    [52, 48, 44, 40],
    maxTextWidth,
  );
  const line1Y = 238;
  const line2Y = line1Y + tagSize + 4;

  ctx.font = tagFont(tagSize);
  ctx.fillStyle = FOREGROUND;
  ctx.fillText("Build ", TEXT_X, line1Y);
  const buildW = ctx.measureText("Build ").width;
  ctx.fillStyle = AMBER;
  ctx.fillText("Big.", TEXT_X + buildW, line1Y);

  ctx.fillStyle = FOREGROUND;
  ctx.fillText("Automate ", TEXT_X, line2Y);
  const autoW = ctx.measureText("Automate ").width;
  ctx.fillStyle = AMBER;
  ctx.fillText("Everything.", TEXT_X + autoW, line2Y);

  // Subtitle.
  const subY = line2Y + 42;
  ctx.font = `400 21px Outfit`;
  ctx.fillStyle = MUTED;
  ctx.fillText("A Create-powered Minecraft server.", TEXT_X, subY);

  // CTA chip: the domain.
  const chipY = subY + 22;
  const chipH = 44;
  const padX = 20;
  const rest = "createrington.com";
  ctx.font = `600 22px Outfit`;
  const restW = ctx.measureText(rest).width;
  const chipW = padX * 2 + restW;

  ctx.fillStyle = "rgba(255,185,0,0.10)";
  roundRectPath(ctx, TEXT_X, chipY, chipW, chipH, 11);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,185,0,0.40)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, TEXT_X + 0.5, chipY + 0.5, chipW - 1, chipH - 1, 11);
  ctx.stroke();

  ctx.fillStyle = AMBER;
  ctx.textBaseline = "middle";
  ctx.fillText(rest, TEXT_X + padX, chipY + chipH / 2 + 1);
}

// Draws the team lineup under the link. Bottom-aligns each posed figure to a
// shared ground line and rim-lights it in the brand amber.
async function paintTeam(ctx: SKRSContext2D): Promise<void> {
  const loaded = await Promise.all(
    TEAM.map(async (m) => {
      const img = await getTeamFigure(m);
      return { img, bbox: computeBBox(img) };
    }),
  );

  const groundY = 600;
  const figH = 118;
  const gap = 16;

  // The skin-api renders every pose at the same camera scale, so a single
  // scale (keyed off the tallest standing figure) keeps the lineup consistent.
  // Scaling each figure to a common height instead would blow up vertically
  // compact poses (e.g. "relaxed").
  const refHeight = Math.max(...loaded.map((f) => f.bbox.height));
  const scale = figH / refHeight;

  let x = TEXT_X;
  for (const { img, bbox } of loaded) {
    const drawW = bbox.width * scale;
    const drawH = bbox.height * scale;
    const drawY = groundY - drawH;

    ctx.save();
    ctx.shadowColor = "rgba(255,185,0,0.32)";
    ctx.shadowBlur = 9;
    ctx.drawImage(
      img,
      bbox.minX,
      bbox.minY,
      bbox.width,
      bbox.height,
      x,
      drawY,
      drawW,
      drawH,
    );
    ctx.restore();

    ctx.drawImage(
      img,
      bbox.minX,
      bbox.minY,
      bbox.width,
      bbox.height,
      x,
      drawY,
      drawW,
      drawH,
    );

    x += drawW + gap;
  }
}

async function main(): Promise<void> {
  const outPath = process.argv[2] ?? join(ASSETS, "og", "og-card.png");

  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-400.woff2"), "Outfit");
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-500.woff2"), "Outfit");
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-600.woff2"), "Outfit");
  GlobalFonts.registerFromPath(join(FONTS, "outfit-latin-700.woff2"), "Outfit");

  const canvas = createCanvas(W * SUPERSAMPLE, H * SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

  paintBackground(ctx);
  await paintFrames(ctx);
  await paintText(ctx);
  await paintTeam(ctx);

  const out = createCanvas(W, H);
  out.getContext("2d").drawImage(canvas, 0, 0, W, H);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, out.toBuffer("image/png"));
  console.log(`wrote ${outPath} (${W}x${H})`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
