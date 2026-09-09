import type { Level, LevelId } from "./levels";
import { context2d, createCanvas } from "./skin";
import { GROUND_ROWS, type Sprite, type Sprites } from "./sprites";
import { hash, mix, rgb, type Rgb } from "./util";

export type View = {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  texel: number;
  groundPx: number;
  worldWidth: number;
  scroll: number;
  time: number;
  nightMix: number;
};

export type Drifter = {
  x: number;
  y: number;
  depth: number;
  scale: number;
  frame: number;
  frameT: number;
};

type OverworldPalette = {
  skyTop: Rgb;
  skyBottom: Rgb;
  far: Rgb;
  near: Rgb;
  trees: Rgb;
  grassTop: Rgb;
  grassEdge: Rgb;
  dirt: Rgb;
  dirtDot: Rgb;
};

const STAR_COUNT = 40;
const GROUND_TILE = 64;
const NIGHT_STEPS = 16;
export const NIGHT_TINT = "12, 18, 44";

const DAY: OverworldPalette = {
  skyTop: [111, 178, 232],
  skyBottom: [201, 223, 245],
  far: [122, 160, 176],
  near: [82, 132, 96],
  trees: [52, 98, 60],
  grassTop: [124, 182, 64],
  grassEdge: [91, 140, 47],
  dirt: [121, 85, 58],
  dirtDot: [92, 63, 42],
};

const NIGHT: OverworldPalette = {
  skyTop: [12, 18, 44],
  skyBottom: [34, 46, 90],
  far: [40, 50, 86],
  near: [30, 42, 70],
  trees: [20, 30, 52],
  grassTop: [64, 98, 60],
  grassEdge: [46, 74, 44],
  dirt: [64, 48, 40],
  dirtDot: [46, 34, 28],
};

const NETHER = {
  skyTop: [30, 8, 12] as Rgb,
  skyMid: [70, 18, 22] as Rgb,
  skyBottom: [124, 38, 28] as Rgb,
  ceiling: [58, 18, 20] as Rgb,
  ceilingDark: [40, 12, 14] as Rgb,
  cliff: [72, 22, 26] as Rgb,
  lava: [235, 120, 30] as Rgb,
  lavaBright: [255, 210, 80] as Rgb,
  lavaGlow: "255, 140, 40",
  fungus: [66, 20, 28] as Rgb,
  glowstone: [232, 194, 96] as Rgb,
  glow: "255, 220, 120",
  ground: [112, 40, 40] as Rgb,
  groundTop: [140, 52, 52] as Rgb,
  groundEdge: [90, 30, 30] as Rgb,
  groundDot: [70, 22, 22] as Rgb,
  groundLight: [150, 62, 62] as Rgb,
};

const END = {
  skyTop: [6, 4, 14] as Rgb,
  skyBottom: [26, 18, 48] as Rgb,
  pillar: [16, 12, 26] as Rgb,
  crystal: [214, 110, 230] as Rgb,
  crystalCore: [255, 230, 255] as Rgb,
  crystalGlow: "214, 110, 230",
  island: [80, 80, 66] as Rgb,
  islandDark: [58, 58, 48] as Rgb,
  chorus: [42, 26, 54] as Rgb,
  chorusFlower: [100, 66, 116] as Rgb,
  ground: [206, 210, 158] as Rgb,
  groundTop: [222, 226, 180] as Rgb,
  groundEdge: [180, 184, 130] as Rgb,
  groundDot: [170, 172, 118] as Rgb,
  groundLight: [232, 236, 196] as Rgb,
};

const tiles = new Map<string, Sprite>();

function sx(view: View, x: number): number {
  return Math.round(x * view.texel);
}

function sy(view: View, height: number): number {
  return view.groundPx - Math.round(height * view.texel);
}

function blit(view: View, sprite: Sprite, x: number, y: number, scale = 1) {
  view.ctx.drawImage(
    sprite,
    Math.round(x),
    Math.round(y),
    sprite.width * view.texel * scale,
    sprite.height * view.texel * scale,
  );
}

function sky(view: View, stops: readonly (readonly [number, string])[]) {
  const { ctx, W, H, groundPx } = view;
  const gradient = ctx.createLinearGradient(0, 0, 0, groundPx);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function stars(view: View, intensity: number) {
  const { ctx, W, texel, groundPx } = view;
  const base = ctx.globalAlpha;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < STAR_COUNT; i++) {
    const twinkle =
      0.55 + 0.45 * Math.sin(view.time * (1.5 + hash(i, 3) * 2) + i);
    ctx.globalAlpha = base * intensity * twinkle;
    const size = hash(i, 4) > 0.8 ? texel : Math.max(1, Math.floor(texel / 2));
    ctx.fillRect(
      Math.round(hash(i, 1) * W),
      Math.round(hash(i, 2) * groundPx * 0.7),
      size,
      size,
    );
  }
  ctx.globalAlpha = base;
}

function drifters(
  view: View,
  frames: Sprite[],
  list: Drifter[],
  alpha: number,
) {
  const base = view.ctx.globalAlpha;
  view.ctx.globalAlpha = base * alpha;
  for (const d of list) {
    const sprite = frames[d.frame % frames.length];
    if (sprite) blit(view, sprite, sx(view, d.x), d.y * view.texel, d.scale);
  }
  view.ctx.globalAlpha = base;
}

function segments(
  view: View,
  depth: number,
  segment: number,
  draw: (i: number, x: number) => void,
) {
  const offset = view.scroll * depth;
  const first = Math.floor(offset / segment);
  const count = Math.ceil(view.worldWidth / segment) + 2;
  for (let k = 0; k < count; k++) {
    const i = first + k;
    draw(i, i * segment - offset);
  }
}

function silhouette(
  view: View,
  depth: number,
  segment: number,
  base: number,
  amplitude: number,
  color: string,
  seed: number,
) {
  const { ctx, texel, groundPx } = view;
  ctx.fillStyle = color;
  segments(view, depth, segment, (i, x) => {
    const h = base + hash(i, seed) * amplitude;
    const top = sy(view, h);
    ctx.fillRect(sx(view, x), top, segment * texel + 1, groundPx - top + 1);
    const cap = hash(i, seed + 1) * amplitude * 0.5;
    const capTop = sy(view, h + cap);
    ctx.fillRect(
      sx(view, x + segment * 0.25),
      capTop,
      segment * 0.5 * texel,
      top - capTop + 1,
    );
  });
}

function trees(view: View, depth: number, color: string, seed: number) {
  const { ctx, texel } = view;
  ctx.fillStyle = color;
  segments(view, depth, 22, (i, x) => {
    if (hash(i, seed) >= 0.38) return;
    const trunk = 7 + Math.round(hash(i, seed + 1) * 5);
    ctx.fillRect(sx(view, x + 10), sy(view, trunk), 2 * texel, trunk * texel);
    ctx.fillRect(sx(view, x + 6), sy(view, trunk + 8), 10 * texel, 8 * texel);
    ctx.fillRect(sx(view, x + 8), sy(view, trunk + 10), 6 * texel, 2 * texel);
  });
}

function fungi(view: View, depth: number, color: string, seed: number) {
  const { ctx, texel } = view;
  ctx.fillStyle = color;
  segments(view, depth, 26, (i, x) => {
    if (hash(i, seed) >= 0.36) return;
    const stem = 9 + Math.round(hash(i, seed + 1) * 7);
    const lean = Math.round(hash(i, seed + 2) * 6);
    ctx.fillRect(
      sx(view, x + 10 + lean),
      sy(view, stem),
      3 * texel,
      stem * texel,
    );
    ctx.fillRect(
      sx(view, x + 5 + lean),
      sy(view, stem + 4),
      13 * texel,
      4 * texel,
    );
    ctx.fillRect(
      sx(view, x + 7 + lean),
      sy(view, stem + 6),
      9 * texel,
      2 * texel,
    );
  });
}

function ceiling(view: View) {
  const { ctx, texel, W } = view;
  const rows = 4;
  ctx.fillStyle = rgb(NETHER.ceiling);
  ctx.fillRect(0, 0, W, rows * texel);
  ctx.fillStyle = rgb(NETHER.ceilingDark);
  ctx.fillRect(0, (rows - 1) * texel, W, texel);
  segments(view, 0.3, 12, (i, x) => {
    const n = hash(i, 71);
    if (n < 0.5) {
      const drip = 2 + Math.round(hash(i, 72) * 6);
      const w = 2 + Math.round(hash(i, 74) * 2);
      ctx.fillStyle = rgb(NETHER.ceilingDark);
      ctx.fillRect(sx(view, x + 3), rows * texel, w * texel, drip * texel);
      ctx.fillRect(
        sx(view, x + 3 + Math.floor(w / 2)),
        (rows + drip) * texel,
        texel,
        texel,
      );
    } else if (n > 0.93) {
      const cx = sx(view, x + 4.5);
      const cy = (rows + 1.5) * texel;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9 * texel);
      halo.addColorStop(0, `rgba(${NETHER.glow}, 0.3)`);
      halo.addColorStop(1, `rgba(${NETHER.glow}, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(cx - 9 * texel, cy - 9 * texel, 18 * texel, 18 * texel);
      ctx.fillStyle = rgb(NETHER.glowstone);
      ctx.fillRect(sx(view, x + 2), rows * texel, 5 * texel, 3 * texel);
      ctx.fillRect(sx(view, x + 3), (rows + 3) * texel, 3 * texel, texel);
    }
  });
}

function lavaSea(view: View) {
  const { ctx, texel, W, groundPx } = view;
  const height = 4;
  const top = sy(view, height);
  const glowTop = sy(view, height + 12);
  const glow = ctx.createLinearGradient(0, glowTop, 0, top);
  glow.addColorStop(0, `rgba(${NETHER.lavaGlow}, 0)`);
  glow.addColorStop(1, `rgba(${NETHER.lavaGlow}, 0.35)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, glowTop, W, top - glowTop);
  ctx.fillStyle = rgb(NETHER.lava);
  ctx.fillRect(0, top, W, groundPx - top);
  ctx.fillStyle = rgb(NETHER.lavaBright);
  segments(view, 0.4, 6, (i, x) => {
    const pulse = Math.sin(view.time * 2 + i * 1.7) * 0.3;
    if (hash(i, 75) + pulse < 0.55) return;
    const y = 1 + Math.floor(hash(i, 77) * 2);
    ctx.fillRect(
      sx(view, x + hash(i, 76) * 4),
      sy(view, y),
      texel * (hash(i, 78) > 0.5 ? 2 : 1),
      texel,
    );
  });
}

function pillars(view: View) {
  const { ctx, texel } = view;
  segments(view, 0.15, 48, (i, x) => {
    if (hash(i, 81) >= 0.45) return;
    const width = 6 + Math.round(hash(i, 82) * 4);
    const height = 30 + Math.round(hash(i, 83) * 40);
    const px = x + hash(i, 84) * 24;
    ctx.fillStyle = rgb(END.pillar);
    ctx.fillRect(
      sx(view, px),
      sy(view, height),
      width * texel,
      height * texel + 1,
    );
    const cx = sx(view, px + width / 2);
    const cy = sy(view, height + 3);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7 * texel);
    glow.addColorStop(0, `rgba(${END.crystalGlow}, 0.45)`);
    glow.addColorStop(1, `rgba(${END.crystalGlow}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 7 * texel, cy - 7 * texel, 14 * texel, 14 * texel);
    ctx.fillStyle = rgb(END.crystal);
    ctx.fillRect(cx - 1.5 * texel, sy(view, height + 4), 3 * texel, 3 * texel);
    ctx.fillStyle = rgb(END.crystalCore);
    ctx.fillRect(cx - 0.5 * texel, sy(view, height + 3), texel, texel);
  });
}

function islands(view: View) {
  const { ctx, texel } = view;
  segments(view, 0.28, 40, (i, x) => {
    if (hash(i, 85) >= 0.5) return;
    const width = 16 + Math.round(hash(i, 86) * 20);
    const bottom = 22 + Math.round(hash(i, 87) * 26);
    const height = 5 + Math.round(hash(i, 88) * 5);
    const px = x + hash(i, 89) * 10;
    ctx.fillStyle = rgb(END.island);
    ctx.fillRect(
      sx(view, px),
      sy(view, bottom + height),
      width * texel,
      height * texel,
    );
    ctx.fillStyle = rgb(END.islandDark);
    ctx.fillRect(
      sx(view, px + 2),
      sy(view, bottom + 1),
      (width - 4) * texel,
      texel,
    );
    for (let j = 0; j < 3; j++) {
      const dx = 3 + hash(i * 3 + j, 90) * (width - 6);
      const drop = 1 + Math.round(hash(i * 3 + j, 91) * 2);
      ctx.fillRect(sx(view, px + dx), sy(view, bottom), texel, drop * texel);
    }
  });
}

function chorusSilhouettes(view: View) {
  const { ctx, texel } = view;
  segments(view, 0.55, 22, (i, x) => {
    if (hash(i, 92) >= 0.4) return;
    const h = 8 + Math.round(hash(i, 93) * 8);
    const b = 3 + Math.round(hash(i, 94) * 3);
    const px = x + 8;
    ctx.fillStyle = rgb(END.chorus);
    ctx.fillRect(sx(view, px), sy(view, h), 2 * texel, h * texel);
    ctx.fillRect(sx(view, px + 2), sy(view, h - 3), 3 * texel, texel);
    ctx.fillRect(sx(view, px + 4), sy(view, h - 3 + b), texel, b * texel);
    ctx.fillStyle = rgb(END.chorusFlower);
    ctx.fillRect(sx(view, px - 1), sy(view, h + 2), 4 * texel, 2 * texel);
    ctx.fillRect(sx(view, px + 3), sy(view, h - 1 + b), 3 * texel, 2 * texel);
  });
}

function overworldTile(ctx: CanvasRenderingContext2D, m: number) {
  ctx.fillStyle = mix(DAY.dirt, NIGHT.dirt, m);
  ctx.fillRect(0, 0, GROUND_TILE, GROUND_ROWS);
  ctx.fillStyle = mix(DAY.grassTop, NIGHT.grassTop, m);
  ctx.fillRect(0, 0, GROUND_TILE, 2);
  ctx.fillStyle = mix(DAY.grassEdge, NIGHT.grassEdge, m);
  ctx.fillRect(0, 2, GROUND_TILE, 1);
  for (let i = 0; i < 12; i++) {
    if (hash(i, 51) < 0.5)
      ctx.fillRect(Math.floor(hash(i, 52) * GROUND_TILE), 3, 1, 1);
  }
  ctx.fillStyle = mix(DAY.dirtDot, NIGHT.dirtDot, m);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 61) * GROUND_TILE);
    const y = 4 + Math.floor(hash(i, 62) * (GROUND_ROWS - 4));
    ctx.fillRect(x, y, hash(i, 63) > 0.7 ? 2 : 1, 1);
  }
}

function stoneTile(
  ctx: CanvasRenderingContext2D,
  palette: {
    ground: Rgb;
    groundTop: Rgb;
    groundEdge: Rgb;
    groundDot: Rgb;
    groundLight: Rgb;
  },
) {
  ctx.fillStyle = rgb(palette.ground);
  ctx.fillRect(0, 0, GROUND_TILE, GROUND_ROWS);
  ctx.fillStyle = rgb(palette.groundTop);
  ctx.fillRect(0, 0, GROUND_TILE, 2);
  ctx.fillStyle = rgb(palette.groundEdge);
  ctx.fillRect(0, 2, GROUND_TILE, 1);
  ctx.fillStyle = rgb(palette.groundDot);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 61) * GROUND_TILE);
    const y = 4 + Math.floor(hash(i, 62) * (GROUND_ROWS - 4));
    ctx.fillRect(x, y, hash(i, 63) > 0.7 ? 2 : 1, 1);
  }
  ctx.fillStyle = rgb(palette.groundLight);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(hash(i, 64) * GROUND_TILE);
    const y = 3 + Math.floor(hash(i, 65) * (GROUND_ROWS - 3));
    ctx.fillRect(x, y, 1, 1);
  }
}

export function groundTile(level: LevelId, nightMix: number): Sprite {
  const step = level === "overworld" ? Math.round(nightMix * NIGHT_STEPS) : 0;
  const key = `${level}:${step}`;
  const cached = tiles.get(key);
  if (cached) return cached;
  const tile = createCanvas(GROUND_TILE, GROUND_ROWS);
  const ctx = context2d(tile);
  if (level === "overworld") overworldTile(ctx, step / NIGHT_STEPS);
  else stoneTile(ctx, level === "nether" ? NETHER : END);
  tiles.set(key, tile);
  return tile;
}

function ground(view: View, level: LevelId) {
  const { ctx, texel, groundPx } = view;
  const tile = groundTile(level, view.nightMix);
  const offset = view.scroll % GROUND_TILE;
  const count = Math.ceil(view.worldWidth / GROUND_TILE) + 2;
  for (let k = 0; k < count; k++) {
    ctx.drawImage(
      tile,
      sx(view, k * GROUND_TILE - offset),
      groundPx,
      GROUND_TILE * texel + 1,
      GROUND_ROWS * texel,
    );
  }
}

function overworld(view: View, sprites: Sprites, list: Drifter[]) {
  const { W, texel, groundPx } = view;
  const m = view.nightMix;
  sky(view, [
    [0, mix(DAY.skyTop, NIGHT.skyTop, m)],
    [1, mix(DAY.skyBottom, NIGHT.skyBottom, m)],
  ]);
  if (m > 0.02) stars(view, m);
  blit(view, sprites.sun, W * 0.82 - 4 * texel, 8 * texel + m * groundPx);
  blit(
    view,
    sprites.moon,
    W * 0.76 - 4 * texel,
    groundPx + 2 * texel - m * (groundPx - 6 * texel),
  );
  drifters(view, sprites.levels.overworld.drifter, list, 0.92);
  silhouette(view, 0.18, 24, 10, 16, mix(DAY.far, NIGHT.far, m), 11);
  silhouette(view, 0.32, 18, 5, 9, mix(DAY.near, NIGHT.near, m), 23);
  trees(view, 0.55, mix(DAY.trees, NIGHT.trees, m), 37);
}

function nether(view: View, sprites: Sprites, list: Drifter[]) {
  sky(view, [
    [0, rgb(NETHER.skyTop)],
    [0.55, rgb(NETHER.skyMid)],
    [1, rgb(NETHER.skyBottom)],
  ]);
  drifters(view, sprites.levels.nether.drifter, list, 0.95);
  ceiling(view);
  silhouette(view, 0.18, 24, 26, 22, rgb(NETHER.cliff), 41);
  lavaSea(view);
  fungi(view, 0.55, rgb(NETHER.fungus), 47);
}

function end(view: View, sprites: Sprites, list: Drifter[]) {
  sky(view, [
    [0, rgb(END.skyTop)],
    [1, rgb(END.skyBottom)],
  ]);
  stars(view, 1);
  pillars(view);
  drifters(view, sprites.levels.end.drifter, list, 1);
  islands(view);
  chorusSilhouettes(view);
}

export function drawScene(
  view: View,
  level: Level,
  sprites: Sprites,
  list: Drifter[],
): void {
  if (level.id === "overworld") overworld(view, sprites, list);
  else if (level.id === "nether") nether(view, sprites, list);
  else end(view, sprites, list);
  ground(view, level.id);
}

export function drawNightTint(view: View, strength: number): void {
  if (strength <= 0) return;
  view.ctx.fillStyle = `rgba(${NIGHT_TINT}, ${strength * 0.35})`;
  view.ctx.fillRect(0, 0, view.W, view.H);
}
