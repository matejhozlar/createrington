import type { StructurePackRotationConfig } from "@createrington/shared/db";
import { FALLBACK_TIMEZONE, isTimeZone } from "./timezone";

export type RotationPeriod = "daily" | "weekly" | "monthly";

export type RotationConfig = Omit<StructurePackRotationConfig, "period"> & {
  period: RotationPeriod;
};

export function toRotationConfig(
  row: StructurePackRotationConfig,
): RotationConfig {
  return {
    ...row,
    period: row.period as RotationPeriod,
    timezone: isTimeZone(row.timezone) ? row.timezone : FALLBACK_TIMEZONE,
  };
}

export interface WeightEntry {
  packId: number;
  packName: string;
  weight: number;
  timeFactor: number;
  boostFactor: number;
}
