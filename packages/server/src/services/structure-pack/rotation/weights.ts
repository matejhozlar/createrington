import type { StructurePack } from "@createrington/shared/db";
import { DEFAULT_ELAPSED_WEEKS, T_REF } from "./constants";
import type { WeightEntry } from "./types";

/**
 * Computes a selection weight for each eligible pack.
 *
 * Weight formula per pack:
 *   `timeFactor * timeWeightMultiplier + boostUnits * boostWeightPerUnit`
 *
 * where `timeFactor` is the number of reference weeks (7 days) since the pack was
 * last active. Packs that have never been active default to 4 elapsed weeks so they
 * are reasonably competitive on their first rotation.
 *
 * @param packs - Eligible packs to weight
 * @param boosts - Map of packId → total boost units purchased this cycle
 * @param timeWeightMultiplier - Scalar applied to the time component
 * @param boostWeightPerUnit - Scalar applied to each boost unit
 * @returns Array of weight entries, one per pack, in the same order as `packs`
 */
export function computeWeights(
  packs: StructurePack[],
  boosts: Map<number, number>,
  timeWeightMultiplier = 1.0,
  boostWeightPerUnit = 1.0,
): WeightEntry[] {
  const nowSec = Date.now() / 1000;
  const defaultElapsed = DEFAULT_ELAPSED_WEEKS * T_REF;

  return packs.map((pack) => {
    const lastActivated = pack.lastActivatedAt
      ? pack.lastActivatedAt.getTime() / 1000
      : nowSec - defaultElapsed;

    const timeFactor = (nowSec - lastActivated) / T_REF;
    const boostFactor = boosts.get(pack.id) ?? 0;

    return {
      packId: pack.id,
      packName: pack.name,
      weight:
        timeFactor * timeWeightMultiplier + boostFactor * boostWeightPerUnit,
      timeFactor: Math.round(timeFactor * 100) / 100,
      boostFactor,
    };
  });
}

/**
 * Selects a pack ID from the weight entries using weighted-random sampling.
 *
 * @param weights - Non-empty array of weight entries produced by `computeWeights`
 * @returns The packId of the selected entry
 */
export function selectWeightedRandom(weights: WeightEntry[]): number {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const entry of weights) {
    random -= entry.weight;
    if (random <= 0) return entry.packId;
  }

  // Fallback (shouldn't happen)
  return weights[weights.length - 1].packId;
}
