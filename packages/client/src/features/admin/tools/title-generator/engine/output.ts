import { autoCrop, createFrame, type Frame } from "./canvas";
import type { OutputMode, OutputSettings } from "./types";

const TILE_SIZE = 512;
const TILE_RADIUS = 60;
const TILE_INSET = 52;
const TILE_COLOUR = "#0f0f13";

export function hasFixedLayout(mode: OutputMode) {
  return mode === "minecraft" || mode === "createrington";
}

function createringtonFrame(image: HTMLCanvasElement): Frame {
  const frame = createFrame(TILE_SIZE, TILE_SIZE);
  frame.ctx.fillStyle = TILE_COLOUR;
  frame.ctx.beginPath();
  frame.ctx.roundRect(0, 0, TILE_SIZE, TILE_SIZE, TILE_RADIUS);
  frame.ctx.fill();
  const inner = TILE_SIZE - TILE_INSET * 2;
  const ratio = Math.min(inner / image.width, inner / image.height);
  const w = Math.round(image.width * ratio);
  const h = Math.round(image.height * ratio);
  if (ratio > 1) {
    frame.ctx.imageSmoothingEnabled = false;
  } else {
    frame.ctx.imageSmoothingQuality = "high";
  }
  frame.ctx.drawImage(
    image,
    Math.floor((TILE_SIZE - w) / 2),
    Math.floor((TILE_SIZE - h) / 2),
    w,
    h,
  );
  return frame;
}

function minecraftFrame(
  image: HTMLCanvasElement,
  mode: OutputSettings["minecraftMode"],
): Frame {
  const aspect = image.width / image.height;
  let w = image.width;
  let h = image.height;
  if (image.width > 1024 || image.height > 1024) {
    if (aspect > 1) {
      w = 1024;
      h = Math.max(1, Math.floor(1024 / aspect));
    } else {
      h = 1024;
      w = Math.max(1, Math.floor(1024 * aspect));
    }
  }
  const scaled = createFrame(w, h);
  if (image.width < 64 || image.height < 64) {
    scaled.ctx.imageSmoothingEnabled = false;
  }
  scaled.ctx.drawImage(image, 0, 0, w, h);
  const capped = autoCrop(scaled) ?? scaled;
  const cw = capped.canvas.width;
  const ch = capped.canvas.height;

  if (mode === "1.20") {
    const frame = createFrame(1024, 256);
    const scale = Math.min(1024 / cw, 176 / ch);
    const newWidth = cw * scale;
    const newHeight = ch * scale;
    if (newWidth > cw) frame.ctx.imageSmoothingEnabled = false;
    frame.ctx.drawImage(
      capped.canvas,
      (1024 - newWidth) / 2,
      (176 - newHeight) / 2,
      newWidth,
      newHeight,
    );
    return frame;
  }

  let pre: Frame;
  if (cw < ch * 4) {
    pre = createFrame(ch * 4 + 8, ch + 2);
    pre.ctx.drawImage(capped.canvas, Math.floor((ch * 4 - cw) / 2) + 4, 1);
  } else if (cw > ch * 4) {
    pre = createFrame(cw + 8, Math.floor(cw / 4) + 2);
    pre.ctx.drawImage(
      capped.canvas,
      4,
      Math.floor((pre.canvas.height - ch) / 2),
    );
  } else {
    pre = createFrame(cw + 8, ch + 4);
    pre.ctx.drawImage(capped.canvas, 4, 1);
  }
  const side = Math.floor(pre.canvas.width / 2);
  const frame = createFrame(side, side);
  frame.ctx.drawImage(pre.canvas, 0, 0);
  frame.ctx.drawImage(
    pre.canvas,
    Math.floor(-pre.canvas.width / 2),
    Math.floor(pre.canvas.width / 4),
  );
  return frame;
}

async function layoutFrame(
  image: HTMLCanvasElement,
  settings: OutputSettings,
): Promise<Frame> {
  if (settings.mode === "square") {
    const max = Math.max(image.width, image.height);
    const frame = createFrame(max, max);
    frame.ctx.drawImage(
      image,
      Math.floor(max / 2 - image.width / 2),
      Math.floor(max / 2 - image.height / 2),
    );
    return frame;
  }
  if (settings.mode === "custom") {
    const frame = createFrame(
      settings.resolutionWidth,
      settings.resolutionHeight,
    );
    const ratio = Math.min(
      frame.canvas.width / image.width,
      frame.canvas.height / image.height,
    );
    const w = Math.floor(image.width * ratio);
    const h = Math.floor(image.height * ratio);
    frame.ctx.drawImage(
      image,
      Math.floor(frame.canvas.width / 2 - w / 2),
      Math.floor(frame.canvas.height / 2 - h / 2),
      w,
      h,
    );
    return frame;
  }
  if (settings.mode === "minecraft") {
    return minecraftFrame(image, settings.minecraftMode);
  }
  if (settings.mode === "createrington") {
    return createringtonFrame(image);
  }
  const frame = createFrame(image.width, image.height);
  frame.ctx.drawImage(image, 0, 0);
  return frame;
}

export async function composeOutput(
  image: HTMLCanvasElement,
  settings: OutputSettings,
): Promise<HTMLCanvasElement> {
  const layout = await layoutFrame(image, settings);
  const fixedLayout = hasFixedLayout(settings.mode);
  const padding = fixedLayout ? 0 : settings.padding;
  const out = createFrame(
    layout.canvas.width + padding * 2,
    layout.canvas.height + padding * 2,
  );
  if (!fixedLayout && settings.backgroundColourEnabled) {
    if (settings.backgroundColour2Enabled) {
      const gradient = out.ctx.createLinearGradient(0, 0, 0, out.canvas.height);
      gradient.addColorStop(0, settings.backgroundColour);
      gradient.addColorStop(1, settings.backgroundColour2);
      out.ctx.fillStyle = gradient;
    } else {
      out.ctx.fillStyle = settings.backgroundColour;
    }
    out.ctx.fillRect(0, 0, out.canvas.width, out.canvas.height);
  }
  out.ctx.drawImage(layout.canvas, padding, padding);
  return out.canvas;
}
