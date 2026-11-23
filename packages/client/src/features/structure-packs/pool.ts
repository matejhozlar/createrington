import type { PoolEntry } from "./types";

export const DEFAULT_BOOST_UNIT_PRICE = 50;

export function sortByWeight(pool: PoolEntry[] | undefined): PoolEntry[] {
  return pool ? [...pool].sort((a, b) => b.weight - a.weight) : [];
}

export function sumWeights(pool: PoolEntry[] | undefined): number {
  return pool?.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;
}

export function sumBoosts(pool: PoolEntry[] | undefined): number {
  return pool?.reduce((sum, entry) => sum + entry.boostUnits, 0) ?? 0;
}

export function weightShare(weight: number, totalWeight: number): number {
  return totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
}
