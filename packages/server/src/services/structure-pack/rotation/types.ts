export type RotationPeriod = "daily" | "weekly" | "monthly";

export interface WeightEntry {
  packId: number;
  packName: string;
  weight: number;
  timeFactor: number;
  boostFactor: number;
}
