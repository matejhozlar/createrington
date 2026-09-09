import { context2d, createCanvas } from "./skin";

export type Sprite = HTMLCanvasElement;

export type HitBox = { x: number; y: number; w: number; h: number };

export type ObstacleSprite = {
  frames: Sprite[];
  w: number;
  h: number;
  hit: HitBox;
};

export type Sprites = {
  cactus: ObstacleSprite[];
  creeper: ObstacleSprite;
  minecart: ObstacleSprite;
  phantom: ObstacleSprite;
  cloud: Sprite;
  sun: Sprite;
  moon: Sprite;
  decor: Sprite[];
};

type Palette = Record<string, string>;

export function pixelSprite(rows: string[], palette: Palette): Sprite {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const color = palette[char];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

const CREEPER_ROWS = [
  "GgGGgGGG",
  "GGgGGGgG",
  "GkkGGkkG",
  "GkkGGkkG",
  "GGGkkGGG",
  "GGkkkkGG",
  "GgkGGkgG",
  "GGkGGkGG",
  "gGGGgGGl",
  "GGgGGGgG",
  "GlGGgGGG",
  "gGGgGGGg",
  "GGGGGGgG",
  "GgGGgGGl",
  "GGGGGGGG",
  "GGgGGgGG",
  "gGGGlGGg",
  "GGGgGGGG",
  "GGGGGgGG",
  "GgGGGGGg",
  "gGGGgGGG",
  "GGGgGGGg",
  "GGgGGGgG",
  "gGGGgGGG",
  "GGGgGGGg",
  "gggggggg",
];

const CREEPER_PALETTE: Palette = {
  g: "#3c8f31",
  G: "#57b647",
  l: "#8fdd7a",
  k: "#0d1f0c",
};

const CREEPER_FLASH_PALETTE: Palette = {
  g: "#c9f2c0",
  G: "#eafff0",
  l: "#ffffff",
  k: "#0d1f0c",
};

const CLOUD_ROWS = [
  "....######......",
  "..##########.##.",
  ".###############",
  "################",
  "################",
  ".xxxxxxxxxxxxxx.",
];

const CLOUD_PALETTE: Palette = { "#": "#ffffff", x: "#dbe6f5" };

const SUN_ROWS = [
  "..####..",
  ".######.",
  "###ss###",
  "##ssss##",
  "##ssss##",
  "###ss###",
  ".######.",
  "..####..",
];

const SUN_PALETTE: Palette = { "#": "#ffd54a", s: "#ffef9a" };

const MOON_ROWS = [
  "..####..",
  ".######.",
  "####m###",
  "###mm###",
  "########",
  "##m#####",
  ".######.",
  "..####..",
];

const MOON_PALETTE: Palette = { "#": "#e8e8ec", m: "#b8b8c4" };

const DECOR_PALETTE: Palette = {
  g: "#63a542",
  d: "#4c8a35",
  r: "#d83a2e",
  y: "#f2d24b",
  s: "#8a8a8a",
  S: "#6e6e6e",
};

const DECOR_ROWS: string[][] = [
  [".g..g", "g.g.g", ".ggg."],
  ["g...g", ".g.g.", "dgggd"],
  ["rr.", "rrr", ".r.", ".g.", ".g."],
  [".y.", "yyy", ".y.", ".g.", ".g."],
  ["sss", "sSS"],
  [".g.", "g.g", ".g.", "g.g", ".g."],
];

const CACTUS = {
  body: "#2f8f2e",
  edge: "#1f6320",
  stripe: "#43ab41",
  spike: "#e2e8c9",
  cap: "#5cc257",
};

export function cactusSprite(columns: number, height: number): ObstacleSprite {
  const columnWidth = 10;
  const gap = 2;
  const width = columns * columnWidth + (columns - 1) * gap;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  for (let c = 0; c < columns; c++) {
    const x = c * (columnWidth + gap);
    ctx.fillStyle = CACTUS.body;
    ctx.fillRect(x + 1, 2, columnWidth - 2, height - 2);
    ctx.fillStyle = CACTUS.edge;
    ctx.fillRect(x + 1, 2, 1, height - 2);
    ctx.fillRect(x + columnWidth - 2, 2, 1, height - 2);
    ctx.fillStyle = CACTUS.stripe;
    ctx.fillRect(x + 4, 3, 1, height - 3);
    ctx.fillRect(x + 6, 3, 1, height - 3);
    ctx.fillStyle = CACTUS.cap;
    ctx.fillRect(x + 2, 1, columnWidth - 4, 1);
    ctx.fillRect(x + 3, 0, columnWidth - 6, 1);
    ctx.fillStyle = CACTUS.spike;
    for (let y = 4; y < height - 1; y += 4) {
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + columnWidth - 1, y + 2, 1, 1);
    }
  }
  return {
    frames: [canvas],
    w: width,
    h: height,
    hit: { x: 1, y: 1, w: width - 2, h: height - 1 },
  };
}

const CART = {
  outline: "#3a3a3a",
  body: "#7a7a7a",
  rim: "#9c9c9c",
  shadow: "#5c5c5c",
  wheel: "#2b2b2b",
  hub: "#8c8c8c",
  rail: "#b0b0b0",
  railShade: "#6b6b6b",
  tie: "#5b3d24",
};

function minecartSprite(): ObstacleSprite {
  const width = 28;
  const height = 15;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = CART.tie;
  for (const x of [1, 9, 17, 25]) ctx.fillRect(x, 12, 3, 3);
  ctx.fillStyle = CART.rail;
  ctx.fillRect(0, 13, width, 1);
  ctx.fillStyle = CART.railShade;
  ctx.fillRect(0, 14, width, 1);
  ctx.fillStyle = CART.outline;
  ctx.fillRect(4, 2, 20, 10);
  ctx.fillStyle = CART.body;
  ctx.fillRect(5, 3, 18, 8);
  ctx.fillStyle = CART.rim;
  ctx.fillRect(5, 3, 18, 1);
  ctx.fillStyle = CART.shadow;
  ctx.fillRect(5, 9, 18, 2);
  ctx.fillStyle = CART.wheel;
  ctx.fillRect(6, 10, 4, 3);
  ctx.fillRect(18, 10, 4, 3);
  ctx.fillStyle = CART.hub;
  ctx.fillRect(7, 11, 2, 1);
  ctx.fillRect(19, 11, 2, 1);
  return {
    frames: [canvas],
    w: width,
    h: height,
    hit: { x: 5, y: 3, w: 18, h: 10 },
  };
}

const PHANTOM = {
  body: "#4a5789",
  dark: "#2c3557",
  wing: "#6c7db3",
  edge: "#3a4670",
  eye: "#7ff05a",
};

function phantomFrame(wingsUp: boolean): Sprite {
  const canvas = createCanvas(26, 12);
  const ctx = context2d(canvas);
  const bodyY = wingsUp ? 6 : 3;
  ctx.fillStyle = PHANTOM.dark;
  ctx.fillRect(9, bodyY, 8, 4);
  ctx.fillRect(17, bodyY + 1, 3, 2);
  ctx.fillStyle = PHANTOM.body;
  ctx.fillRect(10, bodyY + 1, 6, 2);
  ctx.fillStyle = PHANTOM.eye;
  ctx.fillRect(9, bodyY + 1, 1, 1);
  for (let i = 0; i < 9; i++) {
    const lift = Math.floor(i * 0.6);
    const y = wingsUp ? bodyY - lift : bodyY + lift;
    ctx.fillStyle = PHANTOM.wing;
    ctx.fillRect(8 - i, y, 1, 2);
    ctx.fillRect(17 + i, y, 1, 2);
    ctx.fillStyle = PHANTOM.edge;
    ctx.fillRect(8 - i, wingsUp ? y : y + 2, 1, 1);
    ctx.fillRect(17 + i, wingsUp ? y : y + 2, 1, 1);
  }
  return canvas;
}

export function buildSprites(): Sprites {
  return {
    cactus: [
      cactusSprite(1, 18),
      cactusSprite(2, 18),
      cactusSprite(1, 30),
      cactusSprite(3, 18),
    ],
    creeper: {
      frames: [
        pixelSprite(CREEPER_ROWS, CREEPER_PALETTE),
        pixelSprite(CREEPER_ROWS, CREEPER_FLASH_PALETTE),
      ],
      w: 8,
      h: CREEPER_ROWS.length,
      hit: { x: 1, y: 1, w: 6, h: CREEPER_ROWS.length - 1 },
    },
    minecart: minecartSprite(),
    phantom: {
      frames: [phantomFrame(true), phantomFrame(false)],
      w: 26,
      h: 12,
      hit: { x: 3, y: 3, w: 20, h: 7 },
    },
    cloud: pixelSprite(CLOUD_ROWS, CLOUD_PALETTE),
    sun: pixelSprite(SUN_ROWS, SUN_PALETTE),
    moon: pixelSprite(MOON_ROWS, MOON_PALETTE),
    decor: DECOR_ROWS.map((rows) => pixelSprite(rows, DECOR_PALETTE)),
  };
}
