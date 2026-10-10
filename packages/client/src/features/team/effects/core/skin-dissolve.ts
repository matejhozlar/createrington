import type { SkinViewer } from "skinview3d";
import { clamp01 } from "./math";

const SKIN_SIZE = 64;
const PIXEL_COUNT = SKIN_SIZE * SKIN_SIZE;
const NOISE_SHARE = 0.3;
const EDGE_WIDTH = 0.07;
const STEPS = 120;

type ModelType = "default" | "slim";
type Sweep = "up" | "down" | "chest";
type Rgb = readonly [number, number, number];

export type SkinDissolveOptions = {
  sweep: Sweep;
  edge: Rgb;
  model: ModelType;
};

const pixelCache = new Map<string, Promise<ImageData>>();

export function loadSkinPixels(url: string): Promise<ImageData> {
  const cached = pixelCache.get(url);
  if (cached) return cached;

  const pending = new Promise<ImageData>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SKIN_SIZE;
      canvas.height = SKIN_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("2d context unavailable"));
        return;
      }
      ctx.drawImage(image, 0, 0);
      resolve(ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE));
    };
    image.onerror = () => reject(new Error(`failed to load ${url}`));
    image.src = url;
  });
  pending.catch(() => pixelCache.delete(url));
  pixelCache.set(url, pending);
  return pending;
}

function bodyHeight(x: number, y: number): number {
  if (y < 16) return y < 8 ? 0 : ((y - 8) / 8) * 0.25;
  const row = y < 32 ? y - 20 : y < 48 ? y - 36 : y - 52;
  const isLeg = y < 48 ? x < 16 : x < 32;
  return (isLeg ? 0.625 : 0.25) + clamp01(row / 12) * 0.375;
}

function sweepOrder(sweep: Sweep, height: number): number {
  if (sweep === "down") return height;
  if (sweep === "up") return 1 - height;
  return Math.abs(height - 0.42) / 0.58;
}

function buildOrder(sweep: Sweep): Float32Array {
  const order = new Float32Array(PIXEL_COUNT);
  for (let y = 0; y < SKIN_SIZE; y++) {
    for (let x = 0; x < SKIN_SIZE; x++) {
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = hash - Math.floor(hash);
      order[y * SKIN_SIZE + x] =
        sweepOrder(sweep, bodyHeight(x, y)) * (1 - NOISE_SHARE) +
        noise * NOISE_SHARE;
    }
  }
  return order;
}

export class SkinDissolve {
  private readonly viewer: SkinViewer;
  private readonly options: SkinDissolveOptions;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly from: ImageData | null;
  private readonly frame: ImageData | null;
  private readonly order: Float32Array;
  private readonly originalModel: ModelType;
  private to: ImageData | null = null;
  private applied = 0;
  private disposed = false;

  constructor(viewer: SkinViewer, url: string, options: SkinDissolveOptions) {
    this.viewer = viewer;
    this.options = options;
    this.order = buildOrder(options.sweep);
    this.originalModel = viewer.playerObject.skin.modelType;

    const canvas = viewer.skinCanvas;
    const usable = canvas.width === SKIN_SIZE && canvas.height === SKIN_SIZE;
    this.ctx = usable
      ? canvas.getContext("2d", { willReadFrequently: true })
      : null;
    this.from = this.ctx?.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE) ?? null;
    this.frame = this.ctx?.createImageData(SKIN_SIZE, SKIN_SIZE) ?? null;

    loadSkinPixels(url)
      .then((pixels) => {
        if (!this.disposed) this.to = pixels;
      })
      .catch(() => {});
  }

  set(progress: number): void {
    const { ctx, from, frame, to } = this;
    if (!ctx || !from || !frame || !to || this.disposed) return;

    const step = Math.round(clamp01(progress) * STEPS);
    if (step === this.applied) return;
    this.applied = step;

    const cut = (step / STEPS) * (1 + EDGE_WIDTH) - EDGE_WIDTH;
    const showEdge = step > 0 && step < STEPS;
    const [edgeR, edgeG, edgeB] = this.options.edge;
    const source = from.data;
    const target = to.data;
    const out = frame.data;

    for (let pixel = 0; pixel < PIXEL_COUNT; pixel++) {
      const index = pixel * 4;
      const order = this.order[pixel];
      const replaced = order < cut || step === STEPS;
      const pixels = replaced ? target : source;
      const lit =
        showEdge &&
        !replaced &&
        order < cut + EDGE_WIDTH &&
        (source[index + 3] > 0 || target[index + 3] > 0);

      if (lit) {
        out[index] = edgeR;
        out[index + 1] = edgeG;
        out[index + 2] = edgeB;
        out[index + 3] = 255;
      } else {
        out[index] = pixels[index];
        out[index + 1] = pixels[index + 1];
        out[index + 2] = pixels[index + 2];
        out[index + 3] = pixels[index + 3];
      }
    }

    ctx.putImageData(frame, 0, 0);
    const skin = this.viewer.playerObject.skin;
    skin.modelType = step > 0 ? this.options.model : this.originalModel;
    if (skin.map) skin.map.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.applied === 0 || !this.ctx || !this.from) return;
    this.ctx.putImageData(this.from, 0, 0);
    const skin = this.viewer.playerObject.skin;
    skin.modelType = this.originalModel;
    if (skin.map) skin.map.needsUpdate = true;
  }
}
