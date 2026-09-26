import { autoCrop, createFrame, loadImage, type Frame } from "./canvas";
import type { OutputSettings } from "./types";

const LEGACY_TITLE_TEMPLATE =
  "/assets/title-generator/minecraft-title-1.19.png";

async function minecraftFrame(
  image: HTMLCanvasElement,
  mode: OutputSettings["minecraftMode"],
): Promise<Frame> {
  const aspect = image.width / image.height;
  let w = image.width;
  let h = image.height;
  if (image.width > 1024 || image.height > 1024) {
    if (aspect > 1) {
      w = 1024;
      h = Math.floor(1024 / aspect);
    } else {
      h = 1024;
      w = Math.floor(1024 * aspect);
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

  if (mode === "1.19") {
    const base = await loadImage(LEGACY_TITLE_TEMPLATE);
    let pre = capped;
    if (cw / ch < 137 / 22) {
      pre = createFrame(Math.floor((ch / 22) * 137), ch);
      pre.ctx.drawImage(
        capped.canvas,
        Math.floor((pre.canvas.width - cw) / 2),
        0,
      );
    } else if (cw / ch > 137 / 22) {
      pre = createFrame(cw, Math.floor((cw / 137) * 22));
      pre.ctx.drawImage(
        capped.canvas,
        0,
        Math.floor((pre.canvas.height - ch) / 2),
      );
    }
    const pw = pre.canvas.width;
    const ph = pre.canvas.height;
    const side = Math.floor((pw / 137) * 128);
    const frame = createFrame(side, side);
    frame.ctx.imageSmoothingEnabled = false;
    frame.ctx.drawImage(base, 0, 0, side, side);
    const split = Math.floor((pw / 274) * 155);
    frame.ctx.drawImage(pre.canvas, 0, 0, split, ph, 0, 0, split, ph);
    frame.ctx.drawImage(
      pre.canvas,
      split,
      0,
      pw - split,
      ph,
      0,
      Math.floor((ph / 44) * 45),
      pw - split,
      ph,
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
  const frame = createFrame(image.width, image.height);
  frame.ctx.drawImage(image, 0, 0);
  return frame;
}

export async function composeOutput(
  image: HTMLCanvasElement,
  settings: OutputSettings,
): Promise<HTMLCanvasElement> {
  const layout = await layoutFrame(image, settings);
  const isMinecraft = settings.mode === "minecraft";
  const padding = isMinecraft ? 0 : settings.padding;
  const out = createFrame(
    layout.canvas.width + padding * 2,
    layout.canvas.height + padding * 2,
  );
  if (!isMinecraft && settings.backgroundColourEnabled) {
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
