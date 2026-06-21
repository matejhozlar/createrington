import { describe, it, expect } from "vitest";
import { BalanceUtils } from "@/db/repositories/balance/utils";

const MAX_BALANCE = 9_223_372_036_854_775n;

describe("BalanceUtils.validate", () => {
  it("accepts zero, integers, and up to 3 decimal places", () => {
    expect(() => BalanceUtils.validate(0)).not.toThrow();
    expect(() => BalanceUtils.validate(100)).not.toThrow();
    expect(() => BalanceUtils.validate(1.5)).not.toThrow();
    expect(() => BalanceUtils.validate(1.234)).not.toThrow();
    expect(() => BalanceUtils.validate(0.001)).not.toThrow();
  });

  it("rejects negative amounts", () => {
    expect(() => BalanceUtils.validate(-1)).toThrow(
      "Amount cannot be negative",
    );
  });

  it("rejects non-finite amounts", () => {
    expect(() => BalanceUtils.validate(Infinity)).toThrow(
      "Amount must be a finite number",
    );
    expect(() => BalanceUtils.validate(NaN)).toThrow(
      "Amount must be a finite number",
    );
  });

  it("rejects more than 3 decimal places", () => {
    expect(() => BalanceUtils.validate(1.2345)).toThrow(
      "Amount can have at most 3 decimal places",
    );
    expect(() => BalanceUtils.validate(0.12345)).toThrow(
      "Amount can have at most 3 decimal places",
    );
  });
});

describe("BalanceUtils.validateBigInt", () => {
  it("accepts zero and values up to MAX_BALANCE", () => {
    expect(() => BalanceUtils.validateBigInt(0n)).not.toThrow();
    expect(() => BalanceUtils.validateBigInt(1500n)).not.toThrow();
    expect(() => BalanceUtils.validateBigInt(MAX_BALANCE)).not.toThrow();
  });

  it("rejects negative bigints", () => {
    expect(() => BalanceUtils.validateBigInt(-1n)).toThrow(
      "Amount cannot be negative",
    );
  });

  it("rejects values above MAX_BALANCE", () => {
    expect(() => BalanceUtils.validateBigInt(MAX_BALANCE + 1n)).toThrow(
      "Amount exceeds maximum balance",
    );
  });
});

describe("BalanceUtils.toStorage / fromStorage", () => {
  it("converts a decimal to its fixed-point storage bigint", () => {
    expect(BalanceUtils.toStorage(1.5)).toBe(1500n);
    expect(BalanceUtils.toStorage(0)).toBe(0n);
    expect(BalanceUtils.toStorage(1.234)).toBe(1234n);
    expect(BalanceUtils.toStorage(1000)).toBe(1_000_000n);
  });

  it("converts a storage bigint back to a decimal", () => {
    expect(BalanceUtils.fromStorage(1500n)).toBe(1.5);
    expect(BalanceUtils.fromStorage(0n)).toBe(0);
    expect(BalanceUtils.fromStorage(1234n)).toBe(1.234);
  });

  it("round-trips decimals through storage without precision loss", () => {
    for (const value of [0, 1, 1.5, 1.234, 999.999, 1234.567]) {
      expect(BalanceUtils.fromStorage(BalanceUtils.toStorage(value))).toBe(
        value,
      );
    }
  });

  it("rejects negative amounts in toStorage", () => {
    expect(() => BalanceUtils.toStorage(-1)).toThrow(
      "Amount cannot be negative",
    );
  });
});

describe("BalanceUtils.format", () => {
  it("formats with a fixed number of decimals (default 3)", () => {
    expect(BalanceUtils.format(1500n)).toBe("1.500");
    expect(BalanceUtils.format(1234n)).toBe("1.234");
  });

  it("honors a custom decimal count", () => {
    expect(BalanceUtils.format(1500n, 2)).toBe("1.50");
    expect(BalanceUtils.format(1500n, 0)).toBe("2");
  });
});

describe("BalanceUtils.formatTrimmed", () => {
  it("strips trailing zeros", () => {
    expect(BalanceUtils.formatTrimmed(1500n)).toBe("1.5");
    expect(BalanceUtils.formatTrimmed(1000n)).toBe("1");
    expect(BalanceUtils.formatTrimmed(1234n)).toBe("1.234");
    expect(BalanceUtils.formatTrimmed(1230n)).toBe("1.23");
  });

  it("returns '0' for a zero balance", () => {
    expect(BalanceUtils.formatTrimmed(0n)).toBe("0");
  });
});

describe("BalanceUtils.formatWithCommas", () => {
  it("groups thousands and keeps fixed decimals", () => {
    expect(BalanceUtils.formatWithCommas(1_500_000n)).toBe("1,500.000");
    expect(BalanceUtils.formatWithCommas(1500n)).toBe("1.500");
  });

  it("does not truncate large balances to significant digits", () => {
    expect(BalanceUtils.formatWithCommas(12_345_678n)).toBe("12,345.678");
    expect(BalanceUtils.formatWithCommas(1_234_567_890n)).toBe("1,234,567.890");
  });
});

describe("BalanceUtils.add", () => {
  it("adds two storage bigints", () => {
    expect(BalanceUtils.add(1000n, 500n)).toBe(1500n);
    expect(BalanceUtils.add(0n, 0n)).toBe(0n);
  });

  it("throws when the result would exceed MAX_BALANCE", () => {
    expect(() => BalanceUtils.add(MAX_BALANCE, 1n)).toThrow(
      "Amount exceeds maximum balance",
    );
  });
});

describe("BalanceUtils.subtract", () => {
  it("subtracts two storage bigints", () => {
    expect(BalanceUtils.subtract(1500n, 500n)).toBe(1000n);
    expect(BalanceUtils.subtract(1000n, 1000n)).toBe(0n);
  });

  it("throws when the result would be negative", () => {
    expect(() => BalanceUtils.subtract(500n, 1000n)).toThrow(
      "Subtraction would result in negative number",
    );
  });
});

describe("BalanceUtils.wouldOverflow", () => {
  it("returns false when the sum stays within MAX_BALANCE", () => {
    expect(BalanceUtils.wouldOverflow(0n, 1)).toBe(false);
    expect(BalanceUtils.wouldOverflow(MAX_BALANCE - 1000n, 1)).toBe(false);
  });

  it("returns true when the sum would exceed MAX_BALANCE", () => {
    expect(BalanceUtils.wouldOverflow(MAX_BALANCE, 1)).toBe(true);
  });
});
