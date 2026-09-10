import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type Image,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import {
  CURSEFORGE_CLASSES,
  curseforgeClassLabel,
} from "@createrington/shared/workshop";
import type { ChangelogEntry } from "@/discord/components/presets/modpack-changelog";

export type ChangelogRowGroup = "added" | "updated" | "removed";

export interface ChangelogRowImage {
  png: Buffer;
  /** False when the icon could not be fetched and a placeholder stands in */
  complete: boolean;
}

export const CHANGELOG_ROW_WIDTH = 752;
export const CHANGELOG_ROW_HEIGHT = 72;

const NAME_UNIT = 4;
const DETAIL_UNIT = 3;
const FONT_PIXELS_PER_EM = 10;
const ICON_SIZE = 64;
const ICON_Y = 4;
const TEXT_X = ICON_SIZE + 4 * NAME_UNIT;
const TEXT_MAX_WIDTH = CHANGELOG_ROW_WIDTH - TEXT_X - NAME_UNIT;
const NAME_BASELINE = 8 * NAME_UNIT;
const DETAIL_BASELINE = 64;
const ELLIPSIS = "...";

const WHITE = { fill: "#FFFFFF", shadow: "#3F3F3F" };
const GRAY = { fill: "#AAAAAA", shadow: "#2A2A2A" };
const PLACEHOLDER_BACKGROUND = "#2B2B30";
const REMOVED_ICON_ALPHA = 0.5;

const FONT_FAMILY = "Createrington Minecraft";
const FALLBACK_FAMILY = "Createrington Fallback";
const ICON_HOST = "media.forgecdn.net";
const ICON_TIMEOUT_MS = 5000;
const FORGECDN_THUMBNAIL_RE = /(\/avatars\/thumbnails\/\d+\/\d+\/)\d+\/\d+\//;
const VERSION_BOUNDARY_RE = /[-_ +]/;
const CACHE_MAX = 512;

const ASSETS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "assets",
);

const rendered = new Map<string, ChangelogRowImage>();
const rendering = new Map<string, Promise<ChangelogRowImage>>();
let fontsRegistered = false;

function registerFonts(): void {
  if (fontsRegistered) return;
  for (const [file, family] of [
    ["minecraft-regular.woff2", FONT_FAMILY],
    ["outfit-latin-400.woff2", FALLBACK_FAMILY],
  ]) {
    const path = join(ASSETS_DIR, "fonts", file);
    if (!GlobalFonts.registerFromPath(path, family)) {
      logger.warn(`Failed to register changelog row font: ${path}`);
    }
  }
  fontsRegistered = true;
}

/** Shortest readable form of a version change: the shared prefix and suffix are dropped at separator boundaries. */
export function versionChange(previous: string, current: string): string {
  if (previous === current) return current;
  const shortest = Math.min(previous.length, current.length);
  let start = 0;
  for (let i = 0; i < shortest && previous[i] === current[i]; i++) {
    if (VERSION_BOUNDARY_RE.test(previous[i])) start = i + 1;
  }
  let end = 0;
  for (
    let i = 1;
    i <= shortest - start &&
    previous[previous.length - i] === current[current.length - i];
    i++
  ) {
    if (VERSION_BOUNDARY_RE.test(previous[previous.length - i])) end = i;
  }
  const before = previous.slice(start, previous.length - end);
  const after = current.slice(start, current.length - end);
  return before && after
    ? `${before} -> ${after}`
    : `${previous} -> ${current}`;
}

/** Second line of a changelog row: project class and disabled tags, then the file label or version change. */
export function changelogRowDetail(
  entry: ChangelogEntry,
  group: ChangelogRowGroup,
): string {
  const tags: string[] = [];
  if (entry.classId !== CURSEFORGE_CLASSES.mods) {
    tags.push(curseforgeClassLabel(entry.classId));
  }
  if (entry.disabled) tags.push("disabled");
  const version =
    group === "updated" && entry.previousLabel !== null
      ? versionChange(entry.previousLabel, entry.label)
      : entry.label;
  return [...tags, version].join(" · ");
}

function iconSource(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== ICON_HOST) {
      return null;
    }
  } catch {
    return null;
  }
  return url.replace(FORGECDN_THUMBNAIL_RE, `$1${ICON_SIZE}/${ICON_SIZE}/`);
}

async function fetchIcon(url: string): Promise<Image | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.debug(`Changelog row icon ${url} answered ${response.status}`);
      return null;
    }
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    logger.debug(`Changelog row icon ${url} could not be loaded:`, error);
    return null;
  }
}

function setFont(ctx: SKRSContext2D, unit: number): void {
  ctx.font = `${FONT_PIXELS_PER_EM * unit}px "${FONT_FAMILY}", "${FALLBACK_FAMILY}"`;
}

function fit(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (
    end > 0 &&
    ctx.measureText(`${text.slice(0, end).trimEnd()}${ELLIPSIS}`).width >
      maxWidth
  ) {
    end--;
  }
  return `${text.slice(0, end).trimEnd()}${ELLIPSIS}`;
}

function drawText(
  ctx: SKRSContext2D,
  text: string,
  baseline: number,
  unit: number,
  color: { fill: string; shadow: string },
): void {
  setFont(ctx, unit);
  const line = fit(ctx, text, TEXT_MAX_WIDTH);
  ctx.fillStyle = color.shadow;
  ctx.fillText(line, TEXT_X + unit, baseline + unit);
  ctx.fillStyle = color.fill;
  ctx.fillText(line, TEXT_X, baseline);
}

function drawPlaceholder(ctx: SKRSContext2D, name: string): void {
  ctx.fillStyle = PLACEHOLDER_BACKGROUND;
  ctx.beginPath();
  ctx.roundRect(0, ICON_Y, ICON_SIZE, ICON_SIZE, 2 * NAME_UNIT);
  ctx.fill();
  const initial = name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase();
  if (!initial) return;
  setFont(ctx, NAME_UNIT);
  ctx.textAlign = "center";
  ctx.fillStyle = GRAY.fill;
  ctx.fillText(
    initial,
    ICON_SIZE / 2,
    ICON_Y + ICON_SIZE / 2 + 3.5 * NAME_UNIT,
  );
  ctx.textAlign = "left";
}

async function draw(
  entry: ChangelogEntry,
  group: ChangelogRowGroup,
  detail: string,
): Promise<ChangelogRowImage> {
  registerFonts();
  const source = iconSource(entry.thumbnailUrl);
  const icon = source ? await fetchIcon(source) : null;
  const canvas = createCanvas(CHANGELOG_ROW_WIDTH, CHANGELOG_ROW_HEIGHT);
  const ctx = canvas.getContext("2d");
  const removed = group === "removed";
  ctx.globalAlpha = removed ? REMOVED_ICON_ALPHA : 1;
  if (icon) {
    ctx.drawImage(icon, 0, ICON_Y, ICON_SIZE, ICON_SIZE);
  } else {
    drawPlaceholder(ctx, entry.name);
  }
  ctx.globalAlpha = 1;
  drawText(ctx, entry.name, NAME_BASELINE, NAME_UNIT, removed ? GRAY : WHITE);
  drawText(ctx, detail, DETAIL_BASELINE, DETAIL_UNIT, GRAY);
  return {
    png: await canvas.encode("png"),
    complete: source === null || icon !== null,
  };
}

/** One changelog entry as a transparent PNG row (icon, then name and version in the Minecraft font), cached in memory once its icon has loaded. */
export async function renderChangelogRow(
  entry: ChangelogEntry,
  group: ChangelogRowGroup,
): Promise<ChangelogRowImage> {
  const detail = changelogRowDetail(entry, group);
  const key = JSON.stringify([entry.name, detail, entry.thumbnailUrl, group]);
  const cached = rendered.get(key);
  if (cached) {
    rendered.delete(key);
    rendered.set(key, cached);
    return cached;
  }
  let pending = rendering.get(key);
  if (!pending) {
    pending = draw(entry, group, detail).finally(() => rendering.delete(key));
    rendering.set(key, pending);
  }
  const image = await pending;
  if (image.complete && !rendered.has(key)) {
    rendered.set(key, image);
    if (rendered.size > CACHE_MAX) {
      rendered.delete(rendered.keys().next().value as string);
    }
  }
  return image;
}
