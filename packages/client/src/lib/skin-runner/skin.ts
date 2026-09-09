import { STEVE_SKIN_DATA_URI } from "./steve";

export type SkinModel = "classic" | "slim";
export type Part = HTMLCanvasElement;

export type FrontParts = {
  head: Part;
  body: Part;
  rightArm: Part;
  leftArm: Part;
  rightLeg: Part;
  leftLeg: Part;
};

export type SideParts = {
  head: Part;
  body: Part;
  nearArm: Part;
  farArm: Part;
  nearLeg: Part;
  farLeg: Part;
};

export type SkinParts = {
  model: SkinModel;
  armWidth: number;
  front: FrontParts;
  side: SideParts;
};

type Rect = readonly [x: number, y: number, w: number, h: number];

const LEGACY_SKIN_HEIGHT = 32;
const SLIM_PROBE_X = 55;
const SLIM_PROBE_Y = 20;
const FAR_LIMB_SHADE = "rgba(0, 0, 0, 0.32)";

export function skinUrl(uuid: string): string {
  return `https://mc-heads.net/skin/${encodeURIComponent(uuid)}`;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export async function loadSkinParts(uuid: string): Promise<SkinParts> {
  const image = await loadImage(skinUrl(uuid)).catch(() =>
    loadImage(STEVE_SKIN_DATA_URI),
  );
  return buildParts(image);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load skin ${src}`));
    image.src = src;
  });
}

function readPixels(image: HTMLImageElement): ImageData | null {
  const canvas = createCanvas(image.width, image.height);
  const ctx = context2d(canvas);
  ctx.drawImage(image, 0, 0);
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

function alphaAt(pixels: ImageData, x: number, y: number): number {
  return pixels.data[(y * pixels.width + x) * 4 + 3] ?? 255;
}

function isFullyOpaque(pixels: ImageData, [x, y, w, h]: Rect): boolean {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (alphaAt(pixels, px, py) < 255) return false;
    }
  }
  return true;
}

function renderFace(
  image: HTMLImageElement,
  base: Rect,
  overlay: Rect | null,
): Part {
  const [, , w, h] = base;
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  ctx.drawImage(image, base[0], base[1], w, h, 0, 0, w, h);
  if (overlay) {
    ctx.drawImage(
      image,
      overlay[0],
      overlay[1],
      overlay[2],
      overlay[3],
      0,
      0,
      w,
      h,
    );
  }
  return canvas;
}

function mirror(part: Part): Part {
  const canvas = createCanvas(part.width, part.height);
  const ctx = context2d(canvas);
  ctx.translate(part.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(part, 0, 0);
  return canvas;
}

function shade(part: Part): Part {
  const canvas = createCanvas(part.width, part.height);
  const ctx = context2d(canvas);
  ctx.drawImage(part, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = FAR_LIMB_SHADE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function buildParts(image: HTMLImageElement): SkinParts {
  const legacy = image.height === LEGACY_SKIN_HEIGHT;
  const pixels = readPixels(image);
  const slim =
    !legacy &&
    pixels !== null &&
    alphaAt(pixels, SLIM_PROBE_X, SLIM_PROBE_Y) === 0;
  const aw = slim ? 3 : 4;

  const face = (base: Rect, overlay: Rect | null) =>
    renderFace(image, base, overlay);
  const modern = (rect: Rect): Rect | null => (legacy ? null : rect);
  const hat = (rect: Rect): Rect | null =>
    pixels && isFullyOpaque(pixels, rect) ? null : rect;

  const rightArmFront = face([44, 20, aw, 12], modern([44, 36, aw, 12]));
  const rightLegFront = face([4, 20, 4, 12], modern([4, 36, 4, 12]));
  const rightArmSide = face([40, 20, 4, 12], modern([40, 36, 4, 12]));
  const rightLegSide = face([0, 20, 4, 12], modern([0, 36, 4, 12]));

  const front: FrontParts = {
    head: face([8, 8, 8, 8], hat([40, 8, 8, 8])),
    body: face([20, 20, 8, 12], modern([20, 36, 8, 12])),
    rightArm: rightArmFront,
    leftArm: legacy
      ? mirror(rightArmFront)
      : face([36, 52, aw, 12], [52, 52, aw, 12]),
    rightLeg: rightLegFront,
    leftLeg: legacy
      ? mirror(rightLegFront)
      : face([20, 52, 4, 12], [4, 52, 4, 12]),
  };

  const side: SideParts = {
    head: face([0, 8, 8, 8], hat([32, 8, 8, 8])),
    body: face([16, 20, 4, 12], modern([16, 36, 4, 12])),
    nearArm: rightArmSide,
    farArm: shade(
      legacy ? rightArmSide : face([32, 52, 4, 12], [48, 52, 4, 12]),
    ),
    nearLeg: rightLegSide,
    farLeg: shade(
      legacy ? rightLegSide : face([16, 52, 4, 12], [0, 52, 4, 12]),
    ),
  };

  return { model: slim ? "slim" : "classic", armWidth: aw, front, side };
}
