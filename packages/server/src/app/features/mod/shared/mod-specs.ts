import currency from "../currency/currency.api-spec";
import parties from "../parties/parties.api-spec";
import presence from "../presence/presence.api-spec";
import trains from "../trains/trains.api-spec";
import type { ApiModuleSpec } from "./api-spec";

export const MOD_SPECS: readonly ApiModuleSpec[] = [
  currency,
  parties,
  presence,
  trains,
];
