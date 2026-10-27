import { SHADOW_DIM, type Bitmap, type Glyph } from "./assets";

export type GlyphOp = {
  glyph: Glyph;
  x: number;
  color: number;
};

export class Framebuffer {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  blend(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const i = (y * this.width + x) * 4;
    const d = this.data;
    const below = (d[i + 3] / 255) * (1 - a);
    const out = a + below;
    d[i] = (r * a + d[i] * below) / out;
    d[i + 1] = (g * a + d[i + 1] * below) / out;
    d[i + 2] = (b * a + d[i + 2] * below) / out;
    d[i + 3] = out * 255;
  }

  fill(x0: number, y0: number, x1: number, y1: number, argb: number) {
    const a = (argb >>> 24) / 255;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        this.blend(
          x,
          y,
          (argb >> 16) & 0xff,
          (argb >> 8) & 0xff,
          argb & 0xff,
          a,
        );
      }
    }
  }

  blit(
    bitmap: Bitmap,
    sx: number,
    sy: number,
    w: number,
    h: number,
    dx: number,
    dy: number,
  ) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((sy + y) * bitmap.width + sx + x) * 4;
        const d = bitmap.data;
        this.blend(dx + x, dy + y, d[i], d[i + 1], d[i + 2], d[i + 3] / 255);
      }
    }
  }

  text(ops: GlyphOp[], x: number, y: number) {
    for (const shadow of [true, false]) {
      const dim = shadow ? SHADOW_DIM : 1;
      const offset = shadow ? 1 : 0;
      for (const op of ops) {
        const { bitmap } = op.glyph;
        const r = ((op.color >> 16) & 0xff) * dim;
        const g = ((op.color >> 8) & 0xff) * dim;
        const b = (op.color & 0xff) * dim;
        for (let py = 0; py < bitmap.height; py++) {
          for (let px = 0; px < bitmap.width; px++) {
            const i = (py * bitmap.width + px) * 4;
            const alpha = bitmap.data[i + 3];
            if (!alpha) continue;
            this.blend(
              x + op.x + px + offset,
              y + py + offset,
              (bitmap.data[i] * r) / 255,
              (bitmap.data[i + 1] * g) / 255,
              (bitmap.data[i + 2] * b) / 255,
              alpha / 255,
            );
          }
        }
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    if (scratch.width !== this.width || scratch.height !== this.height) {
      scratch.width = this.width;
      scratch.height = this.height;
    }
    scratch
      .getContext("2d")
      ?.putImageData(new ImageData(this.data, this.width, this.height), 0, 0);
    return scratch;
  }
}

const scratch = document.createElement("canvas");

export function sizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  devicePixelsPerCss: number,
): CanvasRenderingContext2D | null {
  const width = Math.round(cssWidth * devicePixelsPerCss);
  const height = Math.round(cssHeight * devicePixelsPerCss);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
