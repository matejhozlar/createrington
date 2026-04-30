import type { DIMENSIONS } from "@/lib/minecraft";

export type DimensionFilter = "all" | (typeof DIMENSIONS)[number]["id"];

export interface PartyFilters {
  search: string;
  dimension: DimensionFilter;
  alliedOnly: boolean;
  activeForceloadsOnly: boolean;
  optedInOnly: boolean;
}
