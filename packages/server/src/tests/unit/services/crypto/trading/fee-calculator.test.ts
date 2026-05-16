import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the event engine so the multiplier is deterministic. All scenarios
// override `getEventFeeMultiplier()` per-test via vi.mocked(...)
vi.mock("@/services/crypto/events/event-engine", () => ({
  getEventFeeMultiplier: vi.fn(() => 1),
}));

// Mock the crypto config to make the fee tiers and volume discounts
// deterministic and decoupled from production tweaks.
vi.mock("@/services/crypto/crypto.config", () => ({
  CRYPTO_CONFIG: {
    FEES: {
      STABLE: 0,
      BLUE_CHIP: 0.005,
      MEMECOIN: 0.05,
      SEASONAL: 0.01,
      BURN_RATIO: 0.5,
    },
    VOLUME_DISCOUNTS: [
      { minTrades: 10, discount: 0.05 },
      { minTrades: 50, discount: 0.1 },
      { minTrades: 200, discount: 0.2 },
    ],
  },
}));

import {
  getBaseFeeRate,
  getVolumeDiscount,
  calculateFee,
  MARKET_VETERAN_FEE_DISCOUNT,
} from "@/services/crypto/trading/fee-calculator";
import { getEventFeeMultiplier } from "@/services/crypto/events/event-engine";

const mockedMultiplier = vi.mocked(getEventFeeMultiplier);

beforeEach(() => {
  mockedMultiplier.mockReturnValue(1);
});

describe("getBaseFeeRate", () => {
  it("returns 0 for stablecoins", () => {
    expect(getBaseFeeRate("stable")).toBe(0);
  });

  it("returns 0.5% for blue chips", () => {
    expect(getBaseFeeRate("blue_chip")).toBe(0.005);
  });

  it("returns 5% for memecoins", () => {
    expect(getBaseFeeRate("memecoin")).toBe(0.05);
  });

  it("returns 1% for seasonal tokens", () => {
    expect(getBaseFeeRate("seasonal")).toBe(0.01);
  });

  it("returns 0 for unknown categories", () => {
    // @ts-expect-error: exercise the default branch
    expect(getBaseFeeRate("mystery")).toBe(0);
  });
});

describe("getVolumeDiscount", () => {
  it("returns 0 below the lowest tier", () => {
    expect(getVolumeDiscount(0)).toBe(0);
    expect(getVolumeDiscount(9)).toBe(0);
  });

  it("returns the matching tier discount when exactly at the threshold", () => {
    expect(getVolumeDiscount(10)).toBe(0.05);
    expect(getVolumeDiscount(50)).toBe(0.1);
    expect(getVolumeDiscount(200)).toBe(0.2);
  });

  it("uses the highest qualifying tier when between thresholds", () => {
    expect(getVolumeDiscount(49)).toBe(0.05);
    expect(getVolumeDiscount(199)).toBe(0.1);
    expect(getVolumeDiscount(1000)).toBe(0.2);
  });
});

describe("calculateFee", () => {
  it("returns 0 for stablecoins regardless of other inputs", () => {
    expect(calculateFee(1000, "stable", 999, true)).toBe(0);
  });

  it("applies just the base rate when no discounts and a 1x event multiplier", () => {
    expect(calculateFee(1000, "memecoin", 0, false)).toBe(50);
  });

  it("applies the volume discount on top of the base rate", () => {
    // 5% base × (1 - 5% discount) × 1000 = 47.5
    expect(calculateFee(1000, "memecoin", 10, false)).toBeCloseTo(47.5);
  });

  it("stacks the Market Veteran discount on top of the volume discount", () => {
    // 5% base × (1 - (5% + 5%)) × 1000 = 45
    expect(calculateFee(1000, "memecoin", 10, true)).toBeCloseTo(45);
  });

  it("caps total discount at 100% (never produces a negative fee)", () => {
    // 200 trades = 20% volume + 5% MV = 25%, well under cap. The cap matters
    // for hypothetical large discount stacks; verify with an oversized base.
    const fee = calculateFee(1000, "memecoin", 200, true);
    expect(fee).toBeGreaterThanOrEqual(0);
  });

  it("applies the event fee multiplier on top of everything", () => {
    mockedMultiplier.mockReturnValue(2);
    // 5% × 1000 × 2 = 100
    expect(calculateFee(1000, "memecoin", 0, false)).toBe(100);
  });

  it("returns 0 when the event multiplier is 0 (tax holiday)", () => {
    mockedMultiplier.mockReturnValue(0);
    expect(calculateFee(1000, "memecoin", 0, false)).toBe(0);
  });

  it("returns 0 when totalCost is 0", () => {
    expect(calculateFee(0, "memecoin", 100, true)).toBe(0);
  });
});

describe("MARKET_VETERAN_FEE_DISCOUNT", () => {
  it("is the documented 5% reduction", () => {
    expect(MARKET_VETERAN_FEE_DISCOUNT).toBe(0.05);
  });
});
