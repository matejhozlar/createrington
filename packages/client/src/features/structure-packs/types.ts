import type { RouterOutput } from "@/lib/trpc";

export type PoolEntry =
  RouterOutput["public"]["structurePacks"]["pool"][number];
export type PoolPack = PoolEntry["pack"];
export type PoolMod = PoolPack["mods"][number];
