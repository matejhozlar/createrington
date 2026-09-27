export type Frame = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

export function createFrame(width: number, height: number): Frame {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

export function frameFrom(
  source: CanvasImageSource & { width: number; height: number },
): Frame {
  const frame = createFrame(source.width, source.height);
  frame.ctx.drawImage(source, 0, 0);
  return frame;
}

export function autoCrop(frame: Frame): Frame | null {
  const { width, height } = frame.canvas;
  const { data } = frame.ctx.getImageData(0, 0, width, height);
  let top: number | null = null;
  let left: number | null = null;
  let right: number | null = null;
  let bottom: number | null = null;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);
    if (top === null) top = y;
    if (left === null || x < left) left = x;
    if (right === null || right < x) right = x;
    if (bottom === null || bottom < y) bottom = y;
  }
  if (top === null || left === null || right === null || bottom === null) {
    return null;
  }
  const cropped = createFrame(right - left + 1, bottom - top + 1);
  cropped.ctx.putImageData(
    frame.ctx.getImageData(
      left,
      top,
      cropped.canvas.width,
      cropped.canvas.height,
    ),
    0,
    0,
  );
  return cropped;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Failed to load image ${src.slice(0, 64)}`));
    img.src = src;
  });
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
