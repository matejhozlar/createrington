// Headless tool: composites the social / link-preview card (og-card.png) for
// the Createrington client SPA. Brand assets are read from the client's public
// assets and the repo-root screenshots/ folder; the Outfit webfont lives in
// the shared server assets (src/assets/fonts).
//
// Team figures are rendered once via the skin-api and cached under
// assets/figures/ (committed), so regenerating the card stays offline. That
// cache is shared with every other og card and keyed by username and pose, so
// deleting an entry re-renders it for whichever cards use it. To refresh after
// a skin change, delete the relevant assets/figures/<username>-<pose>.png and
// re-run with the skin-api key in the environment:
//   infisical run --env=dev -- pnpm --filter @createrington/server util:render-og-card
//
// Run: pnpm --filter @createrington/server util:render-og-card [outPath]

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { computeBBox, fitFontSize } from "@/utils/canvas";
import {
  W,
  H,
  BG_TOP,
  BG_BOT,
  CARD,
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

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, "..", "..", "..", "..", "..");
const SHOTS = join(REPO_ROOT, "screenshots");

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
// wordmark + tagline drawn on the left).
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

function getTeamFigure(m: TeamMember): Promise<Image> {
  return getPoseFigure({
    uuid: m.uuid,
    pose: m.pose,
    username: m.username,
  });
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
  drawImageCover(ctx, img, x, y + chromeH, w, bodyH, "top-left");
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

async function paintText(ctx: SKRSContext2D): Promise<void> {
  await paintWordmark(ctx);

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
      const bbox = computeBBox(img);
      if (!bbox) throw new Error(`Empty figure render for ${m.username}`);
      return { img, bbox };
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

  registerBrandFonts();
  await writeCard(outPath, async (ctx) => {
    paintBackground(ctx);
    await paintFrames(ctx);
    await paintText(ctx);
    await paintTeam(ctx);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
