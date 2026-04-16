import { describe, it, expect } from "vitest";
import {
  EVENT_DEFINITIONS,
  type MarketEventType,
} from "@/services/crypto/events/event-definitions";

const ALL_TYPES: MarketEventType[] = [
  "bull_run",
  "bear_market",
  "flash_crash",
  "pump_and_dump",
  "liquidity_drought",
  "gold_rush",
  "supply_shock",
  "tax_holiday",
  "whale_dump",
  "new_listing_frenzy",
];

describe("EVENT_DEFINITIONS catalog", () => {
  it("contains every documented MarketEventType key", () => {
    for (const type of ALL_TYPES) {
      expect(EVENT_DEFINITIONS[type]).toBeDefined();
    }
  });

  it("each definition's type field matches its key (no copy/paste mistakes)", () => {
    for (const [key, def] of Object.entries(EVENT_DEFINITIONS)) {
      expect(def.type).toBe(key);
    }
  });

  it("name and description are non-empty", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      expect(def.name.trim().length).toBeGreaterThan(0);
      expect(def.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("probability is in [0, 1]", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      expect(def.probability).toBeGreaterThanOrEqual(0);
      expect(def.probability).toBeLessThanOrEqual(1);
    }
  });

  it("scope is either 'market' or 'token'", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      expect(["market", "token"]).toContain(def.scope);
    }
  });

  it("token-scoped events declare at least one targetCategory", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      if (def.scope === "token") {
        expect(def.targetCategories).toBeDefined();
        expect(def.targetCategories!.length).toBeGreaterThan(0);
      }
    }
  });

  it("durationMs is null (instant) or a [min, max] pair with min ≤ max", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      if (def.durationMs === null) continue;
      const [min, max] = def.durationMs;
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  });

  it("severity is one of 'info' | 'warning' | 'critical'", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      expect(["info", "warning", "critical"]).toContain(def.severity);
    }
  });

  it("effect multipliers, when present, are non-negative", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      const e = def.effects;
      if (e.volatilityMultiplier !== undefined) {
        expect(e.volatilityMultiplier).toBeGreaterThanOrEqual(0);
      }
      if (e.feeMultiplier !== undefined) {
        expect(e.feeMultiplier).toBeGreaterThanOrEqual(0);
      }
      if (e.stablecoinInflationMultiplier !== undefined) {
        expect(e.stablecoinInflationMultiplier).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("instant price/supply changes are within [-1, 1]", () => {
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      const e = def.effects;
      if (e.instantPriceChange !== undefined) {
        expect(e.instantPriceChange).toBeGreaterThanOrEqual(-1);
        expect(e.instantPriceChange).toBeLessThanOrEqual(1);
      }
      if (e.instantSupplyChange !== undefined) {
        expect(e.instantSupplyChange).toBeGreaterThanOrEqual(-1);
        expect(e.instantSupplyChange).toBeLessThanOrEqual(1);
      }
    }
  });
});
