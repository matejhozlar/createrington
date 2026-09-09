import type { LevelId } from "./levels";
import { context2d, createCanvas } from "./skin";
import { hash } from "./util";

export type Sprite = HTMLCanvasElement;

export type HitBox = { x: number; y: number; w: number; h: number };

export type PitKind = "lava" | "void";

export type ObstacleSprite = {
  frames: Sprite[];
  w: number;
  h: number;
  hit: HitBox;
  fps?: number;
  pit?: PitKind;
  rest?: number;
};

export type LevelSprites = {
  decor: Sprite[];
  drifter: Sprite[];
};

export type Sprites = {
  cactus: ObstacleSprite[];
  creeper: ObstacleSprite;
  minecart: ObstacleSprite;
  phantom: ObstacleSprite;
  oak: ObstacleSprite;
  magma: ObstacleSprite;
  lava: ObstacleSprite[];
  blaze: ObstacleSprite;
  hoglin: ObstacleSprite;
  stalactite: ObstacleSprite;
  enderman: ObstacleSprite;
  chorus: ObstacleSprite[];
  bullet: ObstacleSprite;
  endermite: ObstacleSprite;
  island: ObstacleSprite;
  gap: ObstacleSprite[];
  sun: Sprite;
  moon: Sprite;
  obsidian: Sprite;
  endFrame: Sprite;
  endFrameEye: Sprite;
  levels: Record<LevelId, LevelSprites>;
};

type Palette = Record<string, string>;

export const GROUND_ROWS = 14;
export const SLIDE_CLEARANCE = 13;
export const PORTAL_BLOCK = 12;

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

function framed(
  frames: Sprite[],
  hit: HitBox,
  extra: Partial<ObstacleSprite> = {},
): ObstacleSprite {
  const first = frames[0];
  if (!first) throw new Error("obstacle without frames");
  return { frames, w: first.width, h: first.height, hit, ...extra };
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

const OVERWORLD_DECOR_PALETTE: Palette = {
  g: "#63a542",
  d: "#4c8a35",
  r: "#d83a2e",
  y: "#f2d24b",
  s: "#8a8a8a",
  S: "#6e6e6e",
};

const OVERWORLD_DECOR_ROWS: string[][] = [
  [".g..g", "g.g.g", ".ggg."],
  ["g...g", ".g.g.", "dgggd"],
  ["rr.", "rrr", ".r.", ".g.", ".g."],
  [".y.", "yyy", ".y.", ".g.", ".g."],
  ["sss", "sSS"],
  [".g.", "g.g", ".g.", "g.g", ".g."],
];

const NETHER_DECOR_PALETTE: Palette = {
  r: "#b8262a",
  R: "#7d1418",
  f: "#f08a1e",
  y: "#ffd23c",
  b: "#e6e0cf",
  c: "#c3323d",
  s: "#8c4444",
  t: "#2ba48c",
  T: "#1c6f5f",
  k: "#3a2020",
};

const NETHER_DECOR_ROWS: string[][] = [
  [".r.r.", "rRrRr", ".rrr."],
  ["..y..", ".yfy.", "yfffy", ".fff."],
  ["b...b", ".bbb.", "b...b"],
  ["cccc", "cRcc", ".ss.", ".ss."],
  [".ttt.", "tTttt", "..s..", "..s.."],
  ["kkkk", "kk.k"],
  ["..r..", ".rRr.", "r.r.r"],
];

const END_DECOR_PALETTE: Palette = {
  p: "#7a4a90",
  P: "#a879bd",
  f: "#e8d4f0",
  s: "#b9bb8a",
  S: "#9c9e6c",
  t: "#5fc9ad",
};

const END_DECOR_ROWS: string[][] = [
  [".p.", ".p.", "pp.", ".p."],
  ["fff", "fpf", ".p.", ".p."],
  ["ss", "sS"],
  ["sss", "SsS"],
  ["P.P", ".p.", ".p."],
  [".t.", "t.t", ".t."],
];

const GHAST_ROWS = [
  "..wwwwwwwwww....",
  ".wwwwwwwwwwww...",
  ".wwwwwwwwwwww...",
  ".wwgwwwwwwgww...",
  ".wwwwwwwwwwww...",
  ".wwwwwgggwwww...",
  ".wwwwwwwwwwww...",
  ".wwwwwwwwwwww...",
  "..xxxxxxxxxx....",
  "...x..x..x..x...",
  "...x..x..x..x...",
  "...x.....x......",
  "......x.....x...",
];

const GHAST_PALETTE: Palette = { w: "#ededed", x: "#c9c9d2", g: "#5c5c6c" };

type PlantPalette = {
  body: string;
  edge: string;
  stripe: string;
  spike: string;
  cap: string;
};

const CACTUS: PlantPalette = {
  body: "#2f8f2e",
  edge: "#1f6320",
  stripe: "#43ab41",
  spike: "#e2e8c9",
  cap: "#5cc257",
};

const CHORUS: PlantPalette = {
  body: "#6f3d84",
  edge: "#45245a",
  stripe: "#8f5aa6",
  spike: "#c9a4d8",
  cap: "#e8d4f0",
};

export function plantSprite(
  columns: number,
  height: number,
  palette: PlantPalette,
): ObstacleSprite {
  const columnWidth = 10;
  const gap = 2;
  const width = columns * columnWidth + (columns - 1) * gap;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  for (let c = 0; c < columns; c++) {
    const x = c * (columnWidth + gap);
    ctx.fillStyle = palette.body;
    ctx.fillRect(x + 1, 2, columnWidth - 2, height - 2);
    ctx.fillStyle = palette.edge;
    ctx.fillRect(x + 1, 2, 1, height - 2);
    ctx.fillRect(x + columnWidth - 2, 2, 1, height - 2);
    ctx.fillStyle = palette.stripe;
    ctx.fillRect(x + 4, 3, 1, height - 3);
    ctx.fillRect(x + 6, 3, 1, height - 3);
    ctx.fillStyle = palette.cap;
    ctx.fillRect(x + 2, 1, columnWidth - 4, 1);
    ctx.fillRect(x + 3, 0, columnWidth - 6, 1);
    ctx.fillStyle = palette.spike;
    for (let y = 4; y < height - 1; y += 4) {
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + columnWidth - 1, y + 2, 1, 1);
    }
  }
  return framed([canvas], { x: 1, y: 1, w: width - 2, h: height - 1 });
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
  return framed([canvas], { x: 5, y: 3, w: 18, h: 10 });
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

const OAK = {
  trunk: "#6b4426",
  trunkDark: "#4e3119",
  trunkLight: "#8a5a34",
  leaf: "#4f9a3c",
  leafDark: "#386f2c",
  leafLight: "#6fbf52",
  apple: "#d8362a",
};

function oakSprite(): ObstacleSprite {
  const width = 30;
  const height = 62;
  const canopy = height - SLIDE_CLEARANCE;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = OAK.trunk;
  ctx.fillRect(12, canopy - 6, 6, height - canopy + 6);
  ctx.fillStyle = OAK.trunkDark;
  ctx.fillRect(17, canopy - 6, 1, height - canopy + 6);
  ctx.fillStyle = OAK.trunkLight;
  ctx.fillRect(12, canopy - 6, 1, height - canopy + 6);
  for (let y = 0; y < canopy; y++) {
    const rim = y < 3 || y >= canopy - 3 ? 5 : 0;
    const inset = rim + Math.round(hash(y, 7) * 3);
    for (let x = inset; x < width - inset; x++) {
      const n = hash(x * 97 + y, 8);
      ctx.fillStyle =
        n < 0.22 ? OAK.leafDark : n > 0.82 ? OAK.leafLight : OAK.leaf;
      if (n > 0.975 && y > 8 && y < canopy - 6) ctx.fillStyle = OAK.apple;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return framed([canvas], { x: 2, y: 0, w: width - 4, h: canopy });
}

const MAGMA_PALETTE: Palette = {
  k: "#2b1a12",
  d: "#4a2a1c",
  o: "#f28c1e",
  y: "#ffd84a",
  r: "#c8461a",
};

const MAGMA_ROWS: string[][] = [
  [
    "............",
    "............",
    "kkkkkkkkkkkk",
    "kddddddddddk",
    "kdyoddddoydk",
    "kdyoddddoydk",
    "kddddddddddk",
    "kdddooooddkk",
    "kkkkkkkkkkkk",
    "kddrdddrdddk",
    "kdddrdddrddk",
    "kddddddddddk",
    "kdrdddrddrdk",
    "kkkkkkkkkkkk",
  ],
  [
    "kkkkkkkkkkkk",
    "kddddddddddk",
    "kdyoddddoydk",
    "kdyoddddoydk",
    "kddddddddddk",
    "kdddooooddkk",
    "kkkkkkkkkkkk",
    "oooooooooooo",
    "kkkkkkkkkkkk",
    "kddrdddrdddk",
    "kkkkkkkkkkkk",
    "oooooooooooo",
    "kkkkkkkkkkkk",
    "kddddddddddk",
  ],
];

const BLAZE_PALETTE: Palette = {
  y: "#f5c542",
  Y: "#ffe58a",
  k: "#3b2410",
  g: "#b98a2a",
  s: "#8a8378",
};

const BLAZE_ROWS: string[][] = [
  [
    "....s.s.....",
    ".....s......",
    "...yyyyyy...",
    "..gyYyyYyg..",
    "..gykyyykg..",
    "..gyyyyyyg..",
    "...yyykky...",
    "...yyyyyy...",
    ".g........g.",
    ".g..gggg..g.",
    ".g..g..g..g.",
    "....g..g....",
    "....g..g....",
    "............",
  ],
  [
    ".....s......",
    "....s.s.....",
    "...yyyyyy...",
    "...yYyyYy...",
    "..gykyyykg..",
    "..gyyyyyyg..",
    "..gyyykkyg..",
    "...yyyyyy...",
    "....g..g....",
    "..gg.gg.gg..",
    "..g..g..g...",
    ".g........g.",
    ".g........g.",
    "............",
  ],
];

const HOGLIN_PALETTE: Palette = {
  b: "#7a4a3a",
  B: "#b8735e",
  h: "#c9866e",
  k: "#2a1a12",
  t: "#efe6d2",
  d: "#6e3f32",
};

const HOGLIN_ROWS: string[][] = [
  [
    "......bbbbbbbbbbbbb.",
    "....hhbbbbbbbbbbbbbb",
    "..hhhhhBBBBBBBBBBBBb",
    ".hhkhhhBBBBBBBBBBBBb",
    ".hhhhhhBBBBBBBBBBBBb",
    "thhhhhhBBBBBBBBBBBB.",
    ".thhhhhBBBBBBBBBBBB.",
    "..hhhhhBBBBBBBBBBBB.",
    "...ddd..ddd..ddd.ddd",
    "...ddd..ddd..ddd.ddd",
    "...dd...dd....dd..dd",
    "...dd...dd....dd..dd",
    "..dd...dd......dd..d",
    "..dd...dd......dd..d",
  ],
  [
    "......bbbbbbbbbbbbb.",
    "....hhbbbbbbbbbbbbbb",
    "..hhhhhBBBBBBBBBBBBb",
    ".hhkhhhBBBBBBBBBBBBb",
    ".hhhhhhBBBBBBBBBBBBb",
    "thhhhhhBBBBBBBBBBBB.",
    ".thhhhhBBBBBBBBBBBB.",
    "..hhhhhBBBBBBBBBBBB.",
    "...ddd..ddd..ddd.ddd",
    "...ddd..ddd..ddd.ddd",
    "....dd..dd....dd.dd.",
    "....dd..dd....dd.dd.",
    ".....dd.dd....dddd..",
    ".....dd.dd....dddd..",
  ],
];

const ENDERMAN_PALETTE: Palette = {
  k: "#0e0e14",
  b: "#1a1a22",
  P: "#e05cf0",
  p: "#8a3a9c",
};

const ENDERMAN_ROWS: string[][] = [
  [
    "kkkkkkkk",
    "kkkkkkkk",
    "kkkkkkkk",
    "kkkkkkkk",
    "pPPkkPPp",
    "kkkkkkkk",
    "kkkkkkkk",
    "kkkkkkkk",
    ".kbbbbk.",
    ".kbbbbk.",
    ".kbbbbk.",
    ".kbbbbk.",
    ".kbbbbk.",
    ".kbbbbk.",
    ".kbbbbk.",
    ".kbbbbk.",
    ".k.kk.k.",
    ".k.kk.k.",
    ".k.kk.k.",
    ".k.kk.k.",
    ".k.kk.k.",
    ".k.kk.k.",
    "...kk...",
    "...kk...",
    "...kk...",
    "...kk...",
    "...kk...",
    "...kk...",
  ],
  [
    "kkkkkkkk",
    "kkkkkkkk",
    "kkkkkkkk",
    "kkkkkkkk",
    "pPPkkPPp",
    "kkkkkkkk",
    "kkkkkkkk",
    "kkkkkkkk",
    "pkbbbbk.",
    ".kbbbbkp",
    ".kbbbbk.",
    "pkbbbbk.",
    ".kbbbbk.",
    ".kbbbbkp",
    ".kbbbbk.",
    ".kbbbbk.",
    ".k.kk.kp",
    ".k.kk.k.",
    "pk.kk.k.",
    ".k.kk.k.",
    ".k.kk.kp",
    ".k.kk.k.",
    "...kk...",
    "p..kk...",
    "...kk..p",
    "...kk...",
    "...kk...",
    "...kk...",
  ],
];

const BULLET_PALETTE: Palette = {
  W: "#ffffff",
  w: "#e0d0f0",
  p: "#a070d0",
  q: "#6b4a90",
};

const BULLET_ROWS: string[][] = [
  [
    "...pp.......",
    "..pwwp......",
    ".pwWWwp.....",
    "pwWWWWwpp.q.",
    "pwWWWWwppq.q",
    ".pwWWwp.....",
    "..pwwp......",
    "...pp.......",
  ],
  [
    "...pp.......",
    "..pwwp......",
    ".pwwwwp.....",
    "pwwWWwwp.q..",
    "pwwWWwwpq.q.",
    ".pwwwwp.....",
    "..pwwp......",
    "...pp.......",
  ],
];

const ENDERMITE_PALETTE: Palette = {
  p: "#6f4f86",
  P: "#8f6ca6",
  k: "#2a1a34",
  d: "#3d2a4a",
};

const ENDERMITE_ROWS: string[][] = [
  [
    "..PP.PP.PP..",
    ".pppppppppp.",
    "pkppkppkpppp",
    "pppppppppppp",
    ".pdpdpdpdpd.",
    "..d..d..d...",
  ],
  [
    "..PP.PP.PP..",
    ".pppppppppp.",
    "pkppkppkpppp",
    "pppppppppppp",
    ".dpdpdpdpdp.",
    "...d..d..d..",
  ],
];

const LAVA = {
  rim: "#3a1414",
  base: "#e87a1c",
  bright: "#ffd24a",
  dark: "#b8480e",
};

function lavaSprite(width: number): ObstacleSprite {
  const height = GROUND_ROWS + 1;
  const frames: Sprite[] = [];
  for (let f = 0; f < 3; f++) {
    const canvas = createCanvas(width, height);
    const ctx = context2d(canvas);
    ctx.fillStyle = LAVA.rim;
    ctx.fillRect(0, 1, width, 2);
    ctx.fillRect(0, 1, 1, height - 1);
    ctx.fillRect(width - 1, 1, 1, height - 1);
    for (let y = 3; y < height; y++) {
      for (let x = 1; x < width - 1; x++) {
        const n = hash(x * 31 + y * 7 + f * 97, 5);
        ctx.fillStyle =
          n > 0.72 ? LAVA.bright : n < 0.18 ? LAVA.dark : LAVA.base;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    frames.push(canvas);
  }
  return framed(
    frames,
    { x: 3, y: 0, w: width - 6, h: 2 },
    { fps: 5, pit: "lava", rest: -GROUND_ROWS },
  );
}

const VOID = {
  fill: "#07050d",
  star: "#2a2440",
  rim: "#b9bb8a",
};

function voidSprite(width: number): ObstacleSprite {
  const height = GROUND_ROWS + 1;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = VOID.fill;
  ctx.fillRect(0, 1, width, height - 1);
  ctx.fillStyle = VOID.star;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(
      1 + Math.floor(hash(i + width, 11) * (width - 2)),
      4 + Math.floor(hash(i + width, 12) * (height - 5)),
      1,
      1,
    );
  }
  ctx.fillStyle = VOID.rim;
  ctx.fillRect(0, 1, 1, 2);
  ctx.fillRect(width - 1, 1, 1, 2);
  return framed(
    [canvas],
    { x: 2, y: 0, w: width - 4, h: 2 },
    { pit: "void", rest: -GROUND_ROWS },
  );
}

const NETHERRACK = {
  base: "#6e2a2a",
  dark: "#4e1c1c",
  light: "#8a3838",
  drip: "#f5a03c",
};

function stalactiteSprite(): ObstacleSprite {
  const width = 20;
  const height = 100;
  const taper = 8;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  for (let y = 0; y < height; y++) {
    const narrow = Math.max(0, y - (height - taper));
    const rowWidth = width - narrow * 1.75;
    const wobble = Math.round(hash(y, 13) * 1.5);
    const x0 = Math.floor((width - rowWidth) / 2) + wobble;
    const x1 = Math.ceil((width + rowWidth) / 2) - wobble;
    for (let x = x0; x < x1; x++) {
      const n = hash(x * 53 + y, 14);
      ctx.fillStyle =
        n < 0.2
          ? NETHERRACK.dark
          : n > 0.85
            ? NETHERRACK.light
            : NETHERRACK.base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = NETHERRACK.drip;
  ctx.fillRect(width / 2 - 1, height - 3, 2, 3);
  return framed(
    [canvas],
    { x: 4, y: 0, w: width - 8, h: height },
    { rest: SLIDE_CLEARANCE },
  );
}

const END_STONE = {
  base: "#cdd19e",
  top: "#e2e4b6",
  dot: "#b4b884",
  under: "#a8ac78",
  stem: "#7a4a8c",
  flower: "#e8d4f0",
};

function islandSprite(): ObstacleSprite {
  const width = 30;
  const height = 50;
  const plant = 10;
  const crag = 9;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = END_STONE.stem;
  ctx.fillRect(14, 2, 3, plant);
  ctx.fillRect(17, 5, 3, 1);
  ctx.fillRect(19, 3, 2, 3);
  ctx.fillStyle = END_STONE.flower;
  ctx.fillRect(13, 0, 5, 3);
  ctx.fillRect(19, 1, 3, 2);
  for (let x = 0; x < width; x++) {
    const edge = x < 2 || x >= width - 2 ? 2 : 0;
    const top = plant + edge;
    const depth = height - crag + Math.round(hash(x, 9) * crag);
    for (let y = top; y < depth; y++) {
      const n = hash(x * 41 + y, 10);
      ctx.fillStyle =
        y < top + 2
          ? END_STONE.top
          : y >= height - crag
            ? END_STONE.under
            : n < 0.15
              ? END_STONE.dot
              : END_STONE.base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return framed(
    [canvas],
    { x: 2, y: plant, w: width - 4, h: height - plant },
    { rest: SLIDE_CLEARANCE },
  );
}

const OBSIDIAN = {
  base: "#0a0e1a",
  top: "#0f1626",
  bottom: "#04070d",
  edge: "#060910",
  specks: ["#1a2848", "#15244a", "#101c34", "#1e3055"],
};

function obsidianSprite(): Sprite {
  const size = PORTAL_BLOCK;
  const canvas = createCanvas(size, size);
  const ctx = context2d(canvas);
  ctx.fillStyle = OBSIDIAN.base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = OBSIDIAN.top;
  ctx.fillRect(0, 0, size, 1);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle =
      OBSIDIAN.specks[i % OBSIDIAN.specks.length] ?? OBSIDIAN.base;
    ctx.fillRect(
      Math.floor(hash(i, 21) * (size - 2)) + 1,
      Math.floor(hash(i, 22) * (size - 2)) + 1,
      hash(i, 23) > 0.6 ? 2 : 1,
      1,
    );
  }
  ctx.fillStyle = OBSIDIAN.bottom;
  ctx.fillRect(0, size - 1, size, 1);
  ctx.fillStyle = OBSIDIAN.edge;
  ctx.fillRect(size - 1, 0, 1, size);
  return canvas;
}

const END_FRAME = {
  stone: "#d5d8a4",
  stoneDark: "#b9bb8a",
  band: "#3f7a68",
  bandDark: "#2b5648",
  slot: "#12302c",
  eye: "#5fc9ad",
  pupil: "#0d2a26",
};

function endFrameSprite(eye: boolean): Sprite {
  const size = PORTAL_BLOCK;
  const canvas = createCanvas(size, size);
  const ctx = context2d(canvas);
  ctx.fillStyle = END_FRAME.stone;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = END_FRAME.stoneDark;
  ctx.fillRect(0, size - 1, size, 1);
  ctx.fillRect(size - 1, 0, 1, size);
  ctx.fillStyle = END_FRAME.band;
  ctx.fillRect(1, 3, size - 2, 6);
  ctx.fillStyle = END_FRAME.bandDark;
  ctx.fillRect(1, 3, size - 2, 1);
  ctx.fillRect(1, 8, size - 2, 1);
  if (eye) {
    ctx.fillStyle = END_FRAME.slot;
    ctx.fillRect(3, 2, 6, 6);
    ctx.fillStyle = END_FRAME.eye;
    ctx.fillRect(4, 3, 4, 4);
    ctx.fillStyle = END_FRAME.pupil;
    ctx.fillRect(5, 4, 2, 2);
  }
  return canvas;
}

const DRAGON = { body: "#241e34", wing: "#342c4a", eye: "#e070ff" };

function dragonFrame(wingsUp: boolean): Sprite {
  const width = 44;
  const height = 22;
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  const bodyY = 11;
  ctx.fillStyle = DRAGON.body;
  ctx.fillRect(8, bodyY, 22, 4);
  ctx.fillRect(30, bodyY + 1, 8, 2);
  ctx.fillRect(38, bodyY + 2, 5, 1);
  ctx.fillRect(3, bodyY - 1, 7, 4);
  ctx.fillRect(0, bodyY - 1, 4, 2);
  ctx.fillRect(4, bodyY - 3, 2, 2);
  ctx.fillStyle = DRAGON.eye;
  ctx.fillRect(3, bodyY, 1, 1);
  ctx.fillStyle = DRAGON.wing;
  for (let i = 0; i < 10; i++) {
    const y = wingsUp ? bodyY - 1 - i : bodyY + 3 + i;
    const x0 = 12 + Math.floor(i * 0.4);
    const span = 12 + Math.floor(i * 1.3);
    ctx.fillRect(x0, y, span, 1);
  }
  return canvas;
}

export function buildSprites(): Sprites {
  const decor = (rows: string[][], palette: Palette) =>
    rows.map((r) => pixelSprite(r, palette));
  return {
    cactus: [
      plantSprite(1, 18, CACTUS),
      plantSprite(2, 18, CACTUS),
      plantSprite(1, 30, CACTUS),
      plantSprite(3, 18, CACTUS),
    ],
    creeper: framed(
      [
        pixelSprite(CREEPER_ROWS, CREEPER_PALETTE),
        pixelSprite(CREEPER_ROWS, CREEPER_FLASH_PALETTE),
      ],
      { x: 1, y: 1, w: 6, h: CREEPER_ROWS.length - 1 },
    ),
    minecart: minecartSprite(),
    phantom: framed([phantomFrame(true), phantomFrame(false)], {
      x: 3,
      y: 3,
      w: 20,
      h: 7,
    }),
    oak: oakSprite(),
    magma: framed(
      MAGMA_ROWS.map((rows) => pixelSprite(rows, MAGMA_PALETTE)),
      { x: 1, y: 2, w: 10, h: 12 },
      { fps: 3 },
    ),
    lava: [lavaSprite(20), lavaSprite(28), lavaSprite(36)],
    blaze: framed(
      BLAZE_ROWS.map((rows) => pixelSprite(rows, BLAZE_PALETTE)),
      { x: 3, y: 2, w: 6, h: 10 },
      { fps: 5 },
    ),
    hoglin: framed(
      HOGLIN_ROWS.map((rows) => pixelSprite(rows, HOGLIN_PALETTE)),
      { x: 2, y: 2, w: 16, h: 12 },
      { fps: 8 },
    ),
    stalactite: stalactiteSprite(),
    enderman: framed(
      ENDERMAN_ROWS.map((rows) => pixelSprite(rows, ENDERMAN_PALETTE)),
      { x: 2, y: 0, w: 4, h: 28 },
      { fps: 4 },
    ),
    chorus: [
      plantSprite(1, 18, CHORUS),
      plantSprite(2, 18, CHORUS),
      plantSprite(1, 28, CHORUS),
      plantSprite(3, 18, CHORUS),
    ],
    bullet: framed(
      BULLET_ROWS.map((rows) => pixelSprite(rows, BULLET_PALETTE)),
      { x: 1, y: 1, w: 6, h: 6 },
      { fps: 8 },
    ),
    endermite: framed(
      ENDERMITE_ROWS.map((rows) => pixelSprite(rows, ENDERMITE_PALETTE)),
      { x: 1, y: 1, w: 10, h: 5 },
      { fps: 10 },
    ),
    island: islandSprite(),
    gap: [voidSprite(20), voidSprite(26), voidSprite(32)],
    sun: pixelSprite(SUN_ROWS, SUN_PALETTE),
    moon: pixelSprite(MOON_ROWS, MOON_PALETTE),
    obsidian: obsidianSprite(),
    endFrame: endFrameSprite(false),
    endFrameEye: endFrameSprite(true),
    levels: {
      overworld: {
        decor: decor(OVERWORLD_DECOR_ROWS, OVERWORLD_DECOR_PALETTE),
        drifter: [pixelSprite(CLOUD_ROWS, CLOUD_PALETTE)],
      },
      nether: {
        decor: decor(NETHER_DECOR_ROWS, NETHER_DECOR_PALETTE),
        drifter: [pixelSprite(GHAST_ROWS, GHAST_PALETTE)],
      },
      end: {
        decor: decor(END_DECOR_ROWS, END_DECOR_PALETTE),
        drifter: [dragonFrame(true), dragonFrame(false)],
      },
    },
  };
}
