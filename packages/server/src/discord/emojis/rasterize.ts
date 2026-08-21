/**
 * Turns manifest entries into upload-ready image buffers
 *
 * Discord only accepts PNG, JPEG and GIF for emojis, so vector sources are
 * rasterized here at deploy time. Raster sources are passed through untouched -
 * re-encoding a GIF through a canvas would flatten the animation.
 */

import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EMBED_COLORS } from "@/config/discord-colors";
import type { EmojiDefinition } from "./manifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** Discord renders emojis at 128x128; anything larger is wasted bytes */
const RENDER_SIZE = 128;

/** Discord rejects emoji images above 256 KiB */
const MAX_EMOJI_BYTES = 256 * 1024;

/**
 * Vectors are rasterized at this multiple of the final size, then downscaled
 *
 * Supersampling gives noticeably cleaner antialiasing on the thin diagonal
 * strokes lucide icons are full of, and the extra work is deploy-time only.
 */
const SUPERSAMPLE = 4;

/**
 * Fraction of the emoji square left empty on each side
 *
 * Discord crops emojis flush to their bounds, so a little breathing room stops
 * the glyph colliding with adjacent text.
 */
const CONTENT_MARGIN = 0.05;

/**
 * Slack added around the source viewBox before rasterizing
 *
 * Strokes are centred on their path, so half the stroke width spills outside
 * the artwork's nominal bounds and gets clipped by a tight viewBox. The overdraw
 * costs nothing because the artwork is measured and cropped afterwards anyway.
 */
const VIEWBOX_PAD = 0.15;

/** A tint is interpolated into markup, so it has to be a plain hex colour */
const VALID_TINT = /^#[0-9a-fA-F]{6}$/;

/** Alpha above which a pixel counts as painted rather than antialiasing haze */
const ALPHA_THRESHOLD = 4;

/**
 * Bumped slightly above lucide's native stroke-width of 2
 *
 * Emojis are viewed at 22-32px, well below the 24px size that lucide's stroke
 * weight is calibrated for, and the downscale softens the strokes.
 */
const DEFAULT_STROKE_WIDTH = 2.5;

/** Brand gold, shared with the embed accent colour so the two cannot drift */
const DEFAULT_TINT = `#${EMBED_COLORS.GOLD.toString(16).padStart(6, "0")}`;

const ASSETS_DIR = path.join(__dirname, "assets");

/** Formats Discord accepts on upload, mapped to their canonical MIME type */
const RASTER_MIME: Record<string, string> = {
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

interface SvgRenderOptions {
  /** The emoji name, so failures deep in the render name their source */
  readonly name: string;
  /** Colour substituted for `currentColor` */
  readonly tint: string;
  /** Stroke weight override; left alone when undefined */
  readonly strokeWidth?: number;
}

/**
 * Resolves the directory `lucide-static` ships its raw SVG icons in
 *
 * @returns Absolute path to the icons directory
 * @private
 */
function lucideIconsDir(): string {
  return path.join(
    path.dirname(require.resolve("lucide-static/package.json")),
    "icons",
  );
}

/**
 * Forces an explicit pixel size onto the root `<svg>` element
 *
 * The rasterizer renders at the SVG's intrinsic size, so a source that declares
 * 24x24 - or no size at all - would come out tiny and be upscaled into a blurry
 * mess. Existing attributes are stripped first so this works regardless of what
 * the source declared.
 *
 * @param svg - Raw SVG markup
 * @param size - Pixel size to render at
 * @returns SVG markup with explicit width and height
 * @private
 */
function sizeSvg(svg: string, size: number): string {
  return svg
    .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, "$1")
    .replace(/<svg\b/, `<svg width="${size}" height="${size}"`);
}

/**
 * Expands the viewBox so no stroke can be clipped at the edges
 *
 * @param svg - Raw SVG markup
 * @returns SVG markup with a padded viewBox, unchanged if it has none
 * @private
 */
function padViewBox(svg: string): string {
  return svg.replace(/viewBox="([-\d.\s]+)"/, (match, raw: string) => {
    const parts = raw.trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return match;

    const [x, y, width, height] = parts as [number, number, number, number];
    const dx = width * VIEWBOX_PAD;
    const dy = height * VIEWBOX_PAD;
    return `viewBox="${x - dx} ${y - dy} ${width + dx * 2} ${height + dy * 2}"`;
  });
}

/**
 * Applies the manifest's colour and stroke overrides
 *
 * Lucide icons declare `stroke="currentColor"`, which has no meaning outside a
 * CSS context and would rasterize to black - invisible on Discord's dark theme.
 *
 * @param svg - Raw SVG markup
 * @param options - Tint and optional stroke weight
 * @returns Restyled SVG markup
 * @private
 */
function restyleSvg(svg: string, options: SvgRenderOptions): string {
  const restyled = svg.replaceAll("currentColor", options.tint);
  if (options.strokeWidth === undefined) return restyled;

  // Rewritten on the root element rather than by matching a literal weight, so
  // the override still applies to sources that do not use lucide's stroke-width
  // of 2. Child elements declaring their own stroke-width still win by normal
  // SVG inheritance, which is the correct behaviour for hand-authored art.
  return restyled
    .replace(/(<svg\b[^>]*?)\sstroke-width="[^"]*"/, "$1")
    .replace(/<svg\b/, `<svg stroke-width="${options.strokeWidth}"`);
}

/**
 * Finds the tight bounding box of everything actually painted on a canvas
 *
 * @param ctx - The context to scan
 * @param size - Width and height of the square canvas
 * @returns The painted region
 * @throws If the canvas is entirely blank
 * @private
 */
function paintedBounds(
  ctx: SKRSContext2D,
  size: number,
): { x: number; y: number; width: number; height: number } {
  const { data } = ctx.getImageData(0, 0, size, size);

  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3]! > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) throw new Error("rendered to a blank image");

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Rasterizes SVG markup to a transparent 128x128 PNG, fitted to the square
 *
 * The artwork is drawn oversized, measured, then scaled to fill the emoji square
 * with a fixed margin. Measuring rather than assuming means icons with different
 * intrinsic bounds - a wide heart, a tall flask - all come out at a consistent
 * optical size, and nothing is ever clipped.
 *
 * @param svg - Raw SVG markup
 * @param options - Tint and optional stroke weight
 * @returns PNG image bytes
 * @private
 */
async function rasterizeSvg(
  svg: string,
  options: SvgRenderOptions,
): Promise<Buffer> {
  if (!VALID_TINT.test(options.tint)) {
    throw new Error(
      `Emoji "${options.name}": tint "${options.tint}" is not a 6-digit hex colour. An invalid colour renders black, which is invisible on Discord's dark theme.`,
    );
  }

  const supersampled = RENDER_SIZE * SUPERSAMPLE;
  const prepared = sizeSvg(padViewBox(restyleSvg(svg, options)), supersampled);

  let image;
  let bounds;
  const scratch = createCanvas(supersampled, supersampled);
  const scratchCtx = scratch.getContext("2d");

  // Failures here surface in CI as a bare stack trace, so name the entry that
  // produced them rather than leaving the manifest key to be guessed
  try {
    image = await loadImage(Buffer.from(prepared));
    scratchCtx.drawImage(image, 0, 0, supersampled, supersampled);
    bounds = paintedBounds(scratchCtx, supersampled);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Emoji "${options.name}": ${detail}`);
  }

  const target = RENDER_SIZE * (1 - CONTENT_MARGIN * 2);
  const scale = target / Math.max(bounds.width, bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;

  const canvas = createCanvas(RENDER_SIZE, RENDER_SIZE);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    scratch,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    (RENDER_SIZE - width) / 2,
    (RENDER_SIZE - height) / 2,
    width,
    height,
  );

  return canvas.toBuffer("image/png");
}

/**
 * Renders a manifest entry into the bytes Discord should receive
 *
 * @param name - The emoji name, used for error messages
 * @param definition - The manifest entry to render
 * @returns The image bytes and their MIME type
 * @throws If the source file is missing, the format is unsupported, or the
 *   result exceeds Discord's 256 KiB limit
 */
export async function renderEmoji(
  name: string,
  definition: EmojiDefinition,
): Promise<{ data: Buffer; mime: string }> {
  let result: { data: Buffer; mime: string };

  // Destructured so the narrowing sticks: `icon` and `file` are optional rather
  // than literal discriminants, so TypeScript cannot narrow the union in place
  const { icon, file } = definition;
  const tint = definition.tint ?? DEFAULT_TINT;

  if (icon !== undefined) {
    const iconPath = path.join(lucideIconsDir(), `${icon}.svg`);
    let svg: string;
    try {
      svg = await fs.readFile(iconPath, "utf-8");
    } catch {
      throw new Error(
        `Emoji "${name}": lucide icon "${icon}" not found. Check the name at https://lucide.dev/icons`,
      );
    }
    result = {
      data: await rasterizeSvg(svg, {
        name,
        tint,
        strokeWidth: definition.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      }),
      mime: "image/png",
    };
  } else if (file !== undefined) {
    // basename keeps a manifest entry from reaching outside the assets directory
    const assetFile = path.basename(file);
    const assetPath = path.join(ASSETS_DIR, assetFile);
    const extension = path.extname(assetFile).toLowerCase();
    let raw: Buffer;
    try {
      raw = await fs.readFile(assetPath);
    } catch {
      throw new Error(`Emoji "${name}": asset not found at ${assetPath}`);
    }

    if (extension === ".svg") {
      // Bespoke art keeps its own stroke weights unless the manifest overrides
      result = {
        data: await rasterizeSvg(raw.toString("utf-8"), {
          name,
          tint,
          strokeWidth: definition.strokeWidth,
        }),
        mime: "image/png",
      };
    } else {
      const mime = RASTER_MIME[extension];
      if (!mime) {
        throw new Error(
          `Emoji "${name}": unsupported format "${extension}". Discord accepts PNG, JPEG, GIF and (via rasterization) SVG.`,
        );
      }
      // Passed through as-is: re-encoding a GIF here would drop the animation
      result = { data: raw, mime };
    }
  } else {
    throw new Error(`Emoji "${name}": manifest entry has no icon or file`);
  }

  if (result.data.length > MAX_EMOJI_BYTES) {
    throw new Error(
      `Emoji "${name}": ${(result.data.length / 1024).toFixed(1)} KiB exceeds Discord's 256 KiB limit`,
    );
  }

  return result;
}

/**
 * Encodes rendered bytes as the Data URI Discord's emoji endpoint expects
 *
 * Built explicitly rather than leaning on discord.js's `resolveImage`, which
 * hardcodes an `image/jpg` content type for every buffer regardless of the real
 * format. Discord sniffs the bytes and copes either way, but a correct label
 * keeps the payload honest and the logs readable.
 *
 * @param data - Image bytes
 * @param mime - The image's real MIME type
 * @returns A `data:` URI
 */
export function toDataUri(data: Buffer, mime: string): string {
  return `data:${mime};base64,${data.toString("base64")}`;
}
