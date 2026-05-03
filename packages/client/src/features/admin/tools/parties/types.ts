export type DimensionFilter = "all" | string;

export type AlliedFilter = "all" | "allied" | "notAllied";
export type OptedInFilter = "all" | "optedIn" | "optedOut";

export interface PartyFilters {
  search: string;
  dimension: DimensionFilter;
  allied: AlliedFilter;
  activeForceloadsOnly: boolean;
  optedIn: OptedInFilter;
}
