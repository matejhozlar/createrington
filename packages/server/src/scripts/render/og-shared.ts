// Script-only plumbing for the og card renderers: client asset paths, the
// committed posed-figure cache, and the render-to-file wrapper. The canvas
// primitives and brand tokens live in @/utils/og-card so the server can paint
// live cards with the same look.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import {
  paintFigure,
  renderCard,
  W,
  H,
  type FigurePlacement,
  type FigureStyle,
} from "@/utils/og-card";

// Deep import on purpose: the @/services/skin-api barrel pulls in @/config,
// whose env validation these standalone scripts cannot satisfy.
import { MAX_QUALITY_RENDER } from "@/services/skin-api/quality";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, "..", "..", "..", "..", "client", "public");
export const ASSETS = join(PUBLIC, "assets");
// One cache for every card's posed figures, keyed by username and pose.
const FIGURES = join(here, "assets", "figures");

export interface PoseFigureRequest {
  uuid: string;
  pose: string;
  /**
   * Cache key together with `pose`, not just a label: renaming this rebinds
   * or orphans a cache entry. `uuid` is deliberately not part of the key, so
   * changing it is not detected either; delete the cached file to re-render.
   */
  username: string;
}

// Resolve a posed figure PNG: prefer the committed cache, otherwise render it
// via the skin-api and cache it so later card renders stay offline. Every card
// shares one cache directory keyed by username and pose, so the same figure
// requested by two cards is stored (and refreshed) once. A re-render needs the
// cached file deleted first; nothing here detects a changed skin or a changed
// render size. Calls the HTTP endpoint directly rather than via the SDK
// because the SDK does not forward the `outline` option, which gives the
// figures the white edge that reads against the dark card.
export async function getPoseFigure(req: PoseFigureRequest): Promise<Image> {
  const file = join(FIGURES, `${req.username}-${req.pose}.png`);
  if (!existsSync(file)) {
    const { width, height } = MAX_QUALITY_RENDER;
    const apiKey = process.env.SKIN_API_KEY;
    if (!apiKey) {
      throw new Error(
        `Missing cached figure (${file}) and SKIN_API_KEY is not set. ` +
          `Re-run this card's util:render-og-* script once with the ` +
          `skin-api key in the environment to populate the cache, e.g. ` +
          `via infisical run --env=dev`,
      );
    }
    // Defaults to the public skin-api so the script runs without env setup;
    // dev/infisical runs override via SKIN_API_URL.
    const baseUrl = process.env.SKIN_API_URL ?? "https://api.createrington.com";
    const query = new URLSearchParams({
      pose: req.pose,
      width: String(width),
      height: String(height),
      outline: "true",
    });
    const res = await fetch(`${baseUrl}/v1/render?${query}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "createrington-app/og-card",
      },
      body: JSON.stringify({ uuid: req.uuid }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `skin-api render failed for ${req.uuid}/${req.pose} (${res.status}): ${detail}`,
      );
    }
    const png = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, png);
  }
  return loadImage(await readFile(file));
}

export type PosedFigureSpec = PoseFigureRequest & FigurePlacement;

// Paints one posed figure from the cache standing on `groundY`.
export async function paintPosedFigure(
  ctx: SKRSContext2D,
  spec: PosedFigureSpec,
  style: FigureStyle,
): Promise<void> {
  paintFigure(ctx, await getPoseFigure(spec), spec, style);
}

export async function writeCard(
  outPath: string,
  paint: (ctx: SKRSContext2D) => Promise<void>,
): Promise<void> {
  const png = await renderCard(paint);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  console.log(`wrote ${outPath} (${W}x${H})`);
}
