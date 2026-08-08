import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import { AttachmentBuilder } from "discord.js";
import type { KnownPose } from "createrington-skin-api";
import config from "@/config";
import { getSkinApiClient } from "@/services/skin-api";
import { computeBBox, fitFontSize } from "@/utils/canvas";

const W = 1600;
const H = 900;
const SUPERSAMPLE = 2;

const AMBER = "#ffb900";
const FOREGROUND = "#fafafb";
const BG_TOP = "#17171d";
const BG_BOT = "#0b0b0e";

const TEXT_X = 110;
const MAX_TEXT_WIDTH = 800;
const KICKER_BASELINE_Y = 452;

const FIGURE_HEIGHT = 620;
const FIGURE_MAX_WIDTH = 500;
const FIGURE_CENTER_X = 1220;
const FIGURE_GROUND_Y = 800;

const POSES = [
  "cheer",
  "wave",
  "point",
  "cute",
  "sprint",
  "callout",
  "dab",
  "victory",
] as const satisfies readonly KnownPose[];

const MC_HEADS_BODY_URL = "https://mc-heads.net/body";
const FETCH_TIMEOUT_MS = 5000;

const ASSETS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "assets",
);

const welcomeConfig = config.discord.events.onGuildMemberAdd.welcome;

let fontsRegistered = false;

function registerFonts(): void {
  if (fontsRegistered) return;
  for (const weight of [400, 500, 600, 700]) {
    const path = join(ASSETS_DIR, "fonts", `outfit-latin-${weight}.woff2`);
    if (!GlobalFonts.registerFromPath(path, "Outfit")) {
      logger.warn(`Failed to register welcome card font: ${path}`);
    }
  }
  fontsRegistered = true;
}

let wordmarkPromise: Promise<Image | null> | null = null;

function getWordmark(): Promise<Image | null> {
  wordmarkPromise ??= readFile(join(ASSETS_DIR, "createrington-wordmark.png"))
    .then(loadImage)
    .catch((error: unknown) => {
      wordmarkPromise = null;
      logger.warn("Welcome card wordmark unavailable:", error);
      return null;
    });
  return wordmarkPromise;
}

const backgroundCache = new Map<string, Buffer>();

async function fetchBackground(): Promise<Image | null> {
  const urls: readonly string[] = welcomeConfig.backgroundImageUrls;
  if (urls.length === 0) return null;
  const url = urls[Math.floor(Math.random() * urls.length)];
  try {
    let buffer = backgroundCache.get(url);
    if (!buffer) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
      backgroundCache.set(url, buffer);
    }
    return await loadImage(buffer);
  } catch (error) {
    logger.warn(`Welcome card background unavailable (${url}):`, error);
    return null;
  }
}

async function fetchFigure(minecraftUuid: string): Promise<Image | null> {
  const pose = POSES[Math.floor(Math.random() * POSES.length)];
  try {
    const png = await getSkinApiClient().render({
      pose,
      source: { uuid: minecraftUuid },
      options: { width: 600, height: 900 },
    });
    return await loadImage(Buffer.from(png));
  } catch (error) {
    logger.warn(
      `Skin-api render failed for welcome card (${minecraftUuid}, ${pose}):`,
      error,
    );
  }
  try {
    const res = await fetch(`${MC_HEADS_BODY_URL}/${minecraftUuid}/600`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch (error) {
    logger.warn(
      `Fallback figure unavailable for welcome card (${minecraftUuid}):`,
      error,
    );
    return null;
  }
}

function drawBackground(ctx: SKRSContext2D, bg: Image | null): void {
  if (bg) {
    const scale = Math.max(W / bg.width, H / bg.height);
    const dw = bg.width * scale;
    const dh = bg.height * scale;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const fallback = ctx.createLinearGradient(0, 0, 0, H);
    fallback.addColorStop(0, BG_TOP);
    fallback.addColorStop(1, BG_BOT);
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, W, H);
  }

  const scrim = ctx.createLinearGradient(0, 0, W, 0);
  scrim.addColorStop(0, "rgba(8,8,12,0.72)");
  scrim.addColorStop(0.42, "rgba(8,8,12,0.34)");
  scrim.addColorStop(0.7, "rgba(8,8,12,0.08)");
  scrim.addColorStop(1, "rgba(8,8,12,0.22)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  const ground = ctx.createLinearGradient(0, H - 240, 0, H);
  ground.addColorStop(0, "rgba(8,8,12,0)");
  ground.addColorStop(1, "rgba(8,8,12,0.55)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, H - 240, W, 240);

  const pool = ctx.createRadialGradient(
    FIGURE_CENTER_X,
    500,
    40,
    FIGURE_CENTER_X,
    500,
    520,
  );
  pool.addColorStop(0, "rgba(255,185,0,0.14)");
  pool.addColorStop(0.5, "rgba(255,160,0,0.06)");
  pool.addColorStop(1, "rgba(255,160,0,0)");
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, W, H);

  const vignette = ctx.createLinearGradient(0, 0, 0, 200);
  vignette.addColorStop(0, "rgba(0,0,0,0.5)");
  vignette.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, 200);
}

function drawContactShadow(ctx: SKRSContext2D, width: number): void {
  ctx.save();
  ctx.translate(FIGURE_CENTER_X, FIGURE_GROUND_Y + 4);
  ctx.scale(1, 0.16);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.34);
  core.addColorStop(0, "rgba(0,0,0,0.38)");
  core.addColorStop(0.6, "rgba(0,0,0,0.20)");
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, width * 0.34, 0, Math.PI * 2);
  ctx.fill();
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.6);
  halo.addColorStop(0, "rgba(0,0,0,0.14)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, width * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFigure(ctx: SKRSContext2D, img: Image): void {
  const bbox = computeBBox(img);
  if (!bbox) return;
  const scale = Math.min(
    FIGURE_HEIGHT / bbox.height,
    FIGURE_MAX_WIDTH / bbox.width,
  );
  const drawW = bbox.width * scale;
  const drawH = bbox.height * scale;
  const x = FIGURE_CENTER_X - drawW / 2;
  const y = FIGURE_GROUND_Y - drawH;

  drawContactShadow(ctx, drawW);

  ctx.save();
  ctx.shadowColor = "rgba(255,185,0,0.35)";
  ctx.shadowBlur = 26;
  ctx.drawImage(
    img,
    bbox.minX,
    bbox.minY,
    bbox.width,
    bbox.height,
    x,
    y,
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
    y,
    drawW,
    drawH,
  );
}

function drawText(
  ctx: SKRSContext2D,
  wordmark: Image | null,
  username: string,
  memberNumber: number,
): void {
  if (wordmark) {
    const wmW = 430;
    const wmH = (wordmark.height / wordmark.width) * wmW;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(wordmark, TEXT_X, 74, wmW, wmH);
    ctx.restore();
  }

  ctx.textBaseline = "alphabetic";

  ctx.save();
  ctx.letterSpacing = "10px";
  ctx.font = "600 36px Outfit";
  ctx.fillStyle = AMBER;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowOffsetY = 4;
  ctx.fillText("WELCOME", TEXT_X, KICKER_BASELINE_Y);
  ctx.restore();

  const nameFont = (size: number) => `700 ${size}px Outfit`;
  const nameSize = fitFontSize(
    ctx,
    username,
    nameFont,
    [124, 110, 96, 84, 72, 60],
    MAX_TEXT_WIDTH,
  );
  ctx.font = nameFont(nameSize);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = FOREGROUND;
  ctx.fillText(username, TEXT_X, KICKER_BASELINE_Y + nameSize + 24);
  ctx.restore();

  const nameBottom = KICKER_BASELINE_Y + nameSize + 24;

  ctx.save();
  ctx.letterSpacing = "2px";
  ctx.font = "500 40px Outfit";
  ctx.fillStyle = AMBER;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowOffsetY = 4;
  ctx.fillText(`Member #${memberNumber}`, TEXT_X, nameBottom + 84);
  ctx.restore();

  ctx.font = "400 26px Outfit";
  ctx.fillStyle = "rgba(250,250,251,0.62)";
  ctx.fillText("createrington.com", TEXT_X, H - 66);
}

/** Composites the post-registration welcome card: the player's skin rendered
 * in a random pose over a random server screenshot, with username and member
 * number. Background and figure fetches degrade gracefully (gradient backdrop,
 * mc-heads fallback, or no figure) so generation never throws for network
 * reasons alone. */
export async function generateRegistrationWelcomeCard(params: {
  minecraftUuid: string;
  minecraftUsername: string;
  memberNumber: number;
}): Promise<AttachmentBuilder> {
  registerFonts();

  const [background, figure, wordmark] = await Promise.all([
    fetchBackground(),
    fetchFigure(params.minecraftUuid),
    getWordmark(),
  ]);

  const canvas = createCanvas(W * SUPERSAMPLE, H * SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

  drawBackground(ctx, background);
  if (figure) drawFigure(ctx, figure);
  drawText(ctx, wordmark, params.minecraftUsername, params.memberNumber);

  const out = createCanvas(W, H);
  out.getContext("2d").drawImage(canvas, 0, 0, W, H);
  return new AttachmentBuilder(out.toBuffer("image/png"), {
    name: "welcome.png",
  });
}
