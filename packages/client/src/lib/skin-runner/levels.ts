import type { ObstacleSprite, Sprites } from "./sprites";

export type LevelId = "overworld" | "nether" | "end";
export type PortalKind = "nether" | "end";

export type ObstacleKind =
  | "cactus"
  | "creeper"
  | "minecart"
  | "oak"
  | "phantom"
  | "lava"
  | "magma"
  | "stalactite"
  | "blaze"
  | "hoglin"
  | "chorus"
  | "enderman"
  | "gap"
  | "island"
  | "bullet"
  | "endermite";

export type Spawn = {
  kind: ObstacleKind;
  weight: number;
  unlock: number;
  pick: (sprites: Sprites) => readonly ObstacleSprite[];
  speedMul?: number;
  altitudes?: readonly number[];
};

export type DrifterConfig = {
  count: number;
  depth: readonly [number, number];
  y: readonly [number, number];
  drift: number;
  interval: number;
  bigChance: number;
  fps: number;
};

export type ExitPortal = {
  kind: PortalKind;
  color: string;
};

export type Level = {
  id: LevelId;
  name: string;
  span: number;
  portal: ExitPortal | null;
  dust: string;
  gap: readonly [number, number];
  drifters: DrifterConfig;
  roster: readonly Spawn[];
};

export const LEVELS: readonly [Level, ...Level[]] = [
  {
    id: "overworld",
    name: "OVERWORLD",
    span: 500,
    portal: { kind: "nether", color: "120, 80, 240" },
    dust: "201, 180, 138",
    gap: [110, 220],
    drifters: {
      count: 5,
      depth: [0.12, 0.25],
      y: [4, 28],
      drift: 3,
      interval: 0,
      bigChance: 0.4,
      fps: 0,
    },
    roster: [
      {
        kind: "cactus",
        weight: 40,
        unlock: 0,
        pick: (s) => s.cactus.slice(0, 3),
      },
      {
        kind: "cactus",
        weight: 10,
        unlock: 300,
        pick: (s) => s.cactus.slice(3),
      },
      { kind: "creeper", weight: 30, unlock: 0, pick: (s) => [s.creeper] },
      {
        kind: "minecart",
        weight: 15,
        unlock: 100,
        pick: (s) => [s.minecart],
        speedMul: 1.35,
      },
      { kind: "oak", weight: 14, unlock: 150, pick: (s) => [s.oak] },
      {
        kind: "phantom",
        weight: 15,
        unlock: 200,
        pick: (s) => [s.phantom],
        speedMul: 1.25,
        altitudes: [4, 25],
      },
    ],
  },
  {
    id: "nether",
    name: "THE NETHER",
    span: 700,
    portal: { kind: "end", color: "50, 190, 160" },
    dust: "150, 90, 80",
    gap: [100, 200],
    drifters: {
      count: 2,
      depth: [0.1, 0.16],
      y: [10, 34],
      drift: 2,
      interval: 3,
      bigChance: 0,
      fps: 0,
    },
    roster: [
      { kind: "lava", weight: 30, unlock: 0, pick: (s) => s.lava },
      { kind: "magma", weight: 28, unlock: 0, pick: (s) => [s.magma] },
      {
        kind: "stalactite",
        weight: 16,
        unlock: 40,
        pick: (s) => [s.stalactite],
      },
      {
        kind: "blaze",
        weight: 18,
        unlock: 80,
        pick: (s) => [s.blaze],
        speedMul: 1.2,
        altitudes: [4, 22],
      },
      {
        kind: "hoglin",
        weight: 16,
        unlock: 140,
        pick: (s) => [s.hoglin],
        speedMul: 1.35,
      },
    ],
  },
  {
    id: "end",
    name: "THE END",
    span: Infinity,
    portal: null,
    dust: "214, 214, 178",
    gap: [90, 180],
    drifters: {
      count: 1,
      depth: [0.18, 0.22],
      y: [6, 26],
      drift: 9,
      interval: 10,
      bigChance: 0,
      fps: 2,
    },
    roster: [
      {
        kind: "chorus",
        weight: 30,
        unlock: 0,
        pick: (s) => s.chorus.slice(0, 3),
      },
      {
        kind: "chorus",
        weight: 8,
        unlock: 200,
        pick: (s) => s.chorus.slice(3),
      },
      { kind: "enderman", weight: 26, unlock: 0, pick: (s) => [s.enderman] },
      { kind: "gap", weight: 22, unlock: 40, pick: (s) => s.gap },
      { kind: "island", weight: 16, unlock: 80, pick: (s) => [s.island] },
      {
        kind: "bullet",
        weight: 16,
        unlock: 120,
        pick: (s) => [s.bullet],
        speedMul: 1.3,
        altitudes: [4, 27],
      },
      {
        kind: "endermite",
        weight: 14,
        unlock: 180,
        pick: (s) => [s.endermite],
        speedMul: 1.35,
      },
    ],
  },
];
