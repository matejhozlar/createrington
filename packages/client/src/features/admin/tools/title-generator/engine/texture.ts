import {
  fontOverlayPath,
  loadAssetImage,
  loadCharacters,
  overlayPath,
  texturePath,
  tileablePath,
} from "./assets";
import { createFrame, type Frame } from "./canvas";
import type { TextureArgs, Tileable, TitleFont } from "./types";

const STOP_CONFIGS = [
  [0.5],
  [0.4, 0.8],
  [1 / 3, 2 / 3],
  [0.3, 0.6, 0.8],
  [0.2, 0.6],
  [0.2, 0.5, 0.8],
  [0.2, 0.4, 0.7],
  [0.2, 0.4, 0.6, 0.8],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const fract = (n: number) => n - Math.floor(n);

function random(x: number, y: number, z: number) {
  x = fract(x * 0.1031);
  y = fract(y * 0.1031);
  z = fract(z * 0.1031);
  const res = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  return fract((x + y + res * 2) * (z + res));
}

function drawRotatedMirrored(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  mirror: boolean,
) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -(w / 2), -(h / 2), w, h);
  ctx.restore();
}

function upscaleFrame(frame: Frame, width: number, height: number): Frame {
  const next = createFrame(width, height);
  next.ctx.imageSmoothingEnabled = false;
  next.ctx.drawImage(frame.canvas, 0, 0, width, height);
  return next;
}

type TileArea = [number, number, number, number, (number | null)?];

async function paintTileable(
  frame: Frame,
  args: TextureArgs,
  font: TitleFont,
  tileable: Tileable | undefined,
  res: number,
) {
  const { canvas, ctx } = frame;
  const base = await loadAssetImage(
    args.customTexture ??
      (tileable ? tileablePath(tileable, args.tileableVariant) : ""),
  );
  const shifted = createFrame(base.width, base.height);
  const { tileableXOffset: ox, tileableYOffset: oy } = args;
  shifted.ctx.drawImage(base, -ox, -oy);
  if (ox) shifted.ctx.drawImage(base, base.width - ox, -oy);
  if (oy) shifted.ctx.drawImage(base, -ox, base.height - oy);
  if (ox && oy) shifted.ctx.drawImage(base, base.width - ox, base.height - oy);
  const texture = shifted.canvas;
  const width = Math.max(1, Math.round(texture.width * args.tileableScale));
  const height = Math.max(1, Math.round(texture.height * args.tileableScale));
  ctx.globalCompositeOperation = "source-atop";
  const uvScaleW = canvas.width / 16;
  const uvScaleH = canvas.height / 16;
  const characters = await loadCharacters(font.id);

  const tile = (
    target: CanvasRenderingContext2D,
    x: number,
    y: number,
    seed: number,
    mirrorSeed: number,
  ) => {
    if (args.tileableRandomRotations || args.tileableRandomMirroring) {
      drawRotatedMirrored(
        target,
        texture,
        x,
        y,
        width,
        height,
        Math.floor(random(seed, x, y) * 4) *
          90 *
          Number(args.tileableRandomRotations),
        random(mirrorSeed, x, y) < 0.5 && args.tileableRandomMirroring,
      );
    } else {
      target.drawImage(texture, x, y, width, height);
    }
  };

  const within = (value: number, from: number, to: number) =>
    value >= from * res && value <= to * res;

  for (const [i, character] of Object.values(characters).entries()) {
    let faceUV: TileArea | undefined;
    let topUV: TileArea | undefined;
    let bottomUV: TileArea | undefined;
    for (const cube of character) {
      for (const uv of Object.values(cube.faces)) {
        if (!uv) continue;
        const mapped = uv.map((e, index) =>
          Math.round(index % 2 ? e * uvScaleH : e * uvScaleW),
        );
        const middle = font.faces.find(
          (e) =>
            within(mapped[1], e[0], e[e.length - 1]) &&
            within(mapped[3], e[0], e[e.length - 1]),
        );
        if (middle) {
          if (!faceUV) {
            faceUV = [
              Math.min(mapped[0], mapped[2]),
              middle[0] * res,
              Math.max(mapped[0], mapped[2]),
              middle[middle.length - 1] * res,
              middle.length === 4 ? (middle[1] - middle[0]) * res : null,
            ];
          } else {
            faceUV[0] = Math.min(faceUV[0], mapped[0], mapped[2]);
            faceUV[2] = Math.max(faceUV[2], mapped[0], mapped[2]);
          }
          continue;
        }
        const top = font.ends.find(
          (e) => within(mapped[1], e[0], e[1]) && within(mapped[3], e[0], e[1]),
        );
        if (top) {
          if (!topUV) {
            topUV = [
              Math.min(mapped[0], mapped[2]),
              top[0] * res,
              Math.max(mapped[0], mapped[2]),
              top[1] * res,
            ];
          } else {
            topUV[0] = Math.min(topUV[0], mapped[0], mapped[2]);
            topUV[2] = Math.max(topUV[2], mapped[0], mapped[2]);
          }
          continue;
        }
        const bottom = font.ends.find(
          (e) => within(mapped[1], e[2], e[3]) && within(mapped[3], e[2], e[3]),
        );
        if (bottom) {
          if (!bottomUV) {
            bottomUV = [
              Math.min(mapped[0], mapped[2]),
              bottom[2] * res,
              Math.max(mapped[0], mapped[2]),
              bottom[3] * res,
            ];
          } else {
            bottomUV[0] = Math.min(bottomUV[0], mapped[0], mapped[2]);
            bottomUV[2] = Math.max(bottomUV[2], mapped[0], mapped[2]);
          }
        }
      }
    }

    if (faceUV) {
      const area = createFrame(faceUV[2] - faceUV[0], faceUV[3] - faceUV[1]);
      area.ctx.imageSmoothingEnabled = false;
      const start = faceUV[4] ?? 0;
      for (let y = start; y < area.canvas.height; y += height) {
        for (let x = 0; x < area.canvas.width; x += width) {
          tile(area.ctx, x, y, i, i + 400);
        }
      }
      if (start !== 0) {
        for (let y = start; y > 0; y -= height) {
          for (let x = 0; x < area.canvas.width; x += width) {
            if (args.tileableRandomRotations || args.tileableRandomMirroring) {
              drawRotatedMirrored(
                area.ctx,
                texture,
                x,
                y - height,
                width,
                height,
                Math.floor(random(i + 100, x, y) * 4) *
                  90 *
                  Number(args.tileableRandomRotations),
                random(i + 400, x, y) < 0.5 && args.tileableRandomMirroring,
              );
            } else {
              area.ctx.drawImage(texture, x, y - height, width, height);
            }
          }
        }
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(faceUV[0], faceUV[1], area.canvas.width, area.canvas.height);
      ctx.drawImage(area.canvas, faceUV[0], faceUV[1]);
    }

    const edgeShade = `rgba(0, 0, 0, ${(100 - args.edgeBrightness) / 100})`;

    if (topUV) {
      const area = createFrame(topUV[2] - topUV[0], topUV[3] - topUV[1]);
      area.ctx.imageSmoothingEnabled = false;
      for (let y = area.canvas.height; y > 0; y -= height) {
        for (let x = 0; x < area.canvas.width; x += width) {
          if (args.tileableRandomRotations || args.tileableRandomMirroring) {
            drawRotatedMirrored(
              area.ctx,
              texture,
              x,
              y - height,
              width,
              height,
              Math.floor(random(i + 200, x, y) * 4) *
                90 *
                Number(args.tileableRandomRotations),
              random(i + 400, x, y) < 0.5 && args.tileableRandomMirroring,
            );
          } else {
            area.ctx.drawImage(texture, x, y - height, width, height);
          }
        }
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(topUV[0], topUV[1], area.canvas.width, area.canvas.height);
      ctx.drawImage(area.canvas, topUV[0], topUV[1]);
      ctx.fillStyle = edgeShade;
      ctx.fillRect(topUV[0], topUV[1], area.canvas.width, area.canvas.height);
    }

    if (bottomUV) {
      const area = createFrame(
        bottomUV[2] - bottomUV[0],
        bottomUV[3] - bottomUV[1],
      );
      area.ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < area.canvas.height; y += height) {
        for (let x = 0; x < area.canvas.width; x += width) {
          tile(area.ctx, x, y, i + 300, i + 400);
        }
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(
        bottomUV[0],
        bottomUV[1],
        area.canvas.width,
        area.canvas.height,
      );
      ctx.drawImage(area.canvas, bottomUV[0], bottomUV[1]);
      ctx.fillStyle = edgeShade;
      ctx.fillRect(
        bottomUV[0],
        bottomUV[1],
        area.canvas.width,
        area.canvas.height,
      );
    }
  }
}

function paintGradient(
  frame: Frame,
  args: TextureArgs,
  font: TitleFont,
  colours: [string, string, string, string, string],
): Frame {
  let { canvas, ctx } = frame;
  let m = canvas.width / font.textureWidth;
  const enabled = [
    args.gradientColour1Enabled,
    args.gradientColour2Enabled,
    args.gradientColour3Enabled,
  ];
  if (args.smoothGradient) {
    const stops = [
      [colours[0], 0],
      enabled[0] ? [colours[1], 0.25] : null,
      enabled[1] ? [colours[2], 0.5] : null,
      enabled[2] ? [colours[3], 0.75] : null,
      [colours[4], 1],
    ].filter((stop): stop is [string, number] => stop !== null);
    const height = font.ends[font.ends.length - 1][3];
    if (canvas.width < font.textureWidth * 4) {
      ({ canvas, ctx } = upscaleFrame(
        { canvas, ctx },
        font.textureWidth * 4,
        font.textureHeight * 4,
      ));
      m = canvas.width / font.textureWidth;
    }
    ctx.globalCompositeOperation = "source-atop";
    const gradient = ctx.createLinearGradient(0, 0, 0, height * m);
    for (let i = 0; i < font.faces.length; i++) {
      const face = font.faces[i];
      const end = font.ends[i];
      gradient.addColorStop(end[0] / height, colours[0]);
      if (face.length === 2) {
        gradient.addColorStop(face[0] / height, colours[0]);
        for (const [colour, t] of stops) {
          gradient.addColorStop(lerp(face[0], face[1], t) / height, colour);
        }
        gradient.addColorStop(face[1] / height, colours[4]);
      } else {
        gradient.addColorStop(face[0] / height, colours[0]);
        gradient.addColorStop(face[1] / height, colours[0]);
        for (const [colour, t] of stops) {
          gradient.addColorStop(lerp(face[1], face[2], t) / height, colour);
        }
        gradient.addColorStop(face[2] / height, colours[4]);
        gradient.addColorStop(face[3] / height, colours[4]);
      }
      gradient.addColorStop(end[3] / height, colours[4]);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width * m, height * m);
  } else {
    const first = font.faces[0];
    const charHeight = first[3] ? first[2] - first[1] : first[1] - first[0];
    const stops =
      STOP_CONFIGS[
        (Number(enabled[0]) << 2) |
          (Number(enabled[1]) << 1) |
          Number(enabled[2])
      ];
    for (let i = 0; i < font.faces.length; i++) {
      const face = font.faces[i];
      const end = font.ends[i];
      const offset = face[3] ? face[1] : face[0];
      let prev = 0;
      for (let k = 0, j = 0; k < 5; k++) {
        if (!(enabled[k - 1] ?? true)) continue;
        const stopEnd = Math.floor((stops[j] ?? 1) * charHeight);
        ctx.fillStyle = colours[k];
        ctx.fillRect(0, offset + prev, canvas.width, stopEnd - prev);
        prev = stopEnd;
        j++;
      }
      ctx.fillStyle = colours[0];
      ctx.fillRect(
        0,
        end[0],
        canvas.width,
        (face[3] ? face[1] : end[1]) - end[0],
      );
      ctx.fillStyle = colours[4];
      const bottomStart = face[2] ?? end[2];
      ctx.fillRect(0, bottomStart, canvas.width, end[3] - bottomStart);
    }
  }
  ctx.fillStyle = `rgba(0, 0, 0, ${(100 - args.edgeBrightness) / 100})`;
  for (const end of font.ends) {
    ctx.fillRect(0, end[0] * m, canvas.width, end[1] * m - end[0] * m);
    ctx.fillRect(0, end[2] * m, canvas.width, end[3] * m - end[2] * m);
  }
  return { canvas, ctx };
}

async function paintFontOverlay(
  { canvas, ctx }: Frame,
  args: TextureArgs,
  font: TitleFont,
) {
  if (!font.overlay || args.disableFontOverlay) return;
  ctx.globalCompositeOperation = "source-over";
  const overlay = await loadAssetImage(fontOverlayPath(font.id));
  ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
}

export async function makeTexture(
  args: TextureArgs,
  font: TitleFont,
  tileables: Tileable[],
): Promise<HTMLCanvasElement> {
  const img = await loadAssetImage(
    args.customTexture && args.customTextureType === "texture"
      ? args.customTexture
      : texturePath(font.id, args.texture, args.variant),
  );
  const isTileable =
    !!args.tileable ||
    (!!args.customTexture && args.customTextureType === "tileable");
  const res = isTileable ? args.tileableTextureResolution : 1;
  let frame = createFrame(img.width * res, img.height * res);
  frame.ctx.imageSmoothingEnabled = false;
  frame.ctx.drawImage(img, 0, 0, frame.canvas.width, frame.canvas.height);

  if (args.gradientColours) {
    frame = paintGradient(frame, args, font, args.gradientColours);
    await paintFontOverlay(frame, args, font);
  } else if (isTileable) {
    await paintTileable(
      frame,
      args,
      font,
      tileables.find((tileable) => tileable.id === args.tileable),
      res,
    );
    await paintFontOverlay(frame, args, font);
  }

  let { canvas, ctx } = frame;
  let m = canvas.width / font.textureWidth;

  ctx.globalCompositeOperation = "copy";
  ctx.filter = `hue-rotate(${args.hue}deg) saturate(${args.saturation}%) brightness(${args.brightness}%) contrast(${args.contrast}%)`;
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  ctx.filter =
    "hue-rotate(0deg) saturate(100%) brightness(100%) contrast(100%)";
  ctx.globalCompositeOperation = args.blend;
  ctx.fillStyle = args.colour;
  ctx.globalAlpha = args.colourOpacity / 100;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (args.customEdge) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = args.customEdgeColour;
    for (const row of font.ends) {
      ctx.fillRect(0, row[0] * m, canvas.width, (row[1] - row[0]) * m);
      ctx.fillRect(0, row[2] * m, canvas.width, (row[3] - row[2]) * m);
    }
  }

  if (args.customOverlay || (args.overlay && args.overlay !== "none")) {
    const overlay = await loadAssetImage(
      args.customOverlay ?? overlayPath(font.id, args.overlay),
    );
    const tinted = createFrame(overlay.width, overlay.height);
    tinted.ctx.drawImage(overlay, 0, 0);
    tinted.ctx.globalCompositeOperation = args.overlayColourBlend;
    tinted.ctx.fillStyle = args.overlayColour;
    tinted.ctx.fillRect(0, 0, overlay.width, overlay.height);
    tinted.ctx.globalCompositeOperation = "destination-in";
    tinted.ctx.drawImage(overlay, 0, 0);
    if (overlay.width > canvas.width) {
      ({ canvas, ctx } = upscaleFrame(
        { canvas, ctx },
        overlay.width,
        overlay.height,
      ));
      m = canvas.width / font.textureWidth;
    }
    ctx.globalCompositeOperation = args.overlayBlend;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = args.overlayOpacity / 100;
    ctx.drawImage(tinted.canvas, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  if (args.customBorder) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = args.customBorderColour;
    ctx.fillRect(
      0,
      font.border * m,
      canvas.width,
      canvas.height - font.border * m,
    );
  }

  if (args.fadeToBorder) {
    if (canvas.width < font.textureWidth * 4) {
      ({ canvas, ctx } = upscaleFrame(
        { canvas, ctx },
        font.textureWidth * 4,
        font.textureHeight * 4,
      ));
      m = canvas.width / font.textureWidth;
    }
    ctx.globalCompositeOperation = "source-atop";
    const height = font.ends[font.ends.length - 1][3];
    const [r, g, b] = ctx.getImageData(0, font.border * m, 1, 1).data;
    const gradient = ctx.createLinearGradient(0, 0, 0, height * m);
    for (const stop of font.ends) {
      gradient.addColorStop(stop[0] / height, `rgb(${r},${g},${b})`);
      gradient.addColorStop(stop[1] / height, `rgb(${r},${g},${b}, 0)`);
      gradient.addColorStop(stop[2] / height, `rgb(${r},${g},${b}, 0)`);
      gradient.addColorStop(stop[3] / height, `rgb(${r},${g},${b})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width * m, height * m);
  }

  return canvas;
}
