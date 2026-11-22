import type { StructurePackRotationConfig } from "@createrington/shared/db";

export type RotationPeriod = "daily" | "weekly" | "monthly";

export type RotationConfig = Omit<StructurePackRotationConfig, "period"> & {
  period: RotationPeriod;
};

export function toRotationConfig(
  row: StructurePackRotationConfig,
): RotationConfig {
  return { ...row, period: row.period as RotationPeriod };
}

export interface WeightEntry {
  packId: number;
  packName: string;
  weight: number;
  timeFactor: number;
  boostFactor: number;
}
