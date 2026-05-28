/**
 * Conversion and validation helpers for player balances. Balances are stored
 * as bigint with 3 implicit decimal places (1.000 = 1000 in storage). All
 * mutation paths in BalanceRepository go through these helpers for range and
 * precision checks.
 */
export class BalanceUtils {
  private static readonly PRECISION = 1_000;
  private static readonly PRECISION_BIGINT = BigInt(this.PRECISION);

  private static readonly MAX_BALANCE = 9_223_372_036_854_775n;
  private static readonly MAX_BALANCE_BIG_INT = this.MAX_BALANCE;

  /** Throws if amount is negative, non-finite, or has more than 3 decimals. */
  static validate(amount: number): void {
    if (amount < 0) {
      throw new Error("Amount cannot be negative");
    }
    if (!Number.isFinite(amount)) {
      throw new Error("Amount must be a finite number");
    }

    const rounded = Math.round(amount * this.PRECISION) / this.PRECISION;
    if (Math.abs(rounded - amount) > 0.0001) {
      throw new Error("Amount can have at most 3 decimal places");
    }
  }

  /** Throws if amount is negative or exceeds MAX_BALANCE. */
  static validateBigInt(amount: bigint): void {
    if (amount < 0n) {
      throw new Error("Amount cannot be negative");
    }
    if (amount > this.MAX_BALANCE_BIG_INT) {
      throw new Error(`Amount exceeds maximum balance`);
    }
  }

  /** Convert a user-facing decimal to its storage bigint (1.5 -> 1500n). */
  static toStorage(amount: number): bigint {
    this.validate(amount);
    const rounded = Math.round(amount * this.PRECISION);
    return BigInt(rounded);
  }

  /** Convert a storage bigint back to a user-facing decimal (1500n -> 1.5). */
  static fromStorage(amount: bigint): number {
    return Number(amount) / this.PRECISION;
  }

  /** Format a storage bigint as a fixed-decimal string (default 3 decimals). */
  static format(amount: bigint, decimals: number = 3): string {
    const value = this.fromStorage(amount);
    return value.toFixed(decimals);
  }

  /** Format with trailing zeros stripped (1500n -> "1.5", 1234n -> "1.234"). */
  static formatTrimmed(amount: bigint): string {
    const value = this.fromStorage(amount);
    const formatted = value.toFixed(3);
    return formatted.replace(/\.?0+$/, "") || "0";
  }

  /** Format with thousands separators (1500000n -> "1,500.000"). */
  static formatWithCommas(amount: bigint, decimals: number = 3): string {
    const value = this.fromStorage(amount);
    return value.toLocaleString("en-US", {
      maximumFractionDigits: decimals,
      maximumSignificantDigits: decimals,
    });
  }

  /** Add two storage bigints, throwing if the result exceeds MAX_BALANCE. */
  static add(a: bigint, b: bigint): bigint {
    const result = a + b;
    this.validateBigInt(result);
    return result;
  }

  /** Subtract two storage bigints, throwing if the result would be negative. */
  static subtract(a: bigint, b: bigint): bigint {
    const result = a - b;
    if (result < 0n) {
      throw new Error("Subtraction would result in negative number");
    }
    return result;
  }

  /** Returns true if adding amountToAdd to currentBalance would exceed MAX_BALANCE. */
  static wouldOverflow(currentBalance: bigint, amountToAdd: number): boolean {
    const amountBigInt = this.toStorage(amountToAdd);
    return currentBalance + amountBigInt > this.MAX_BALANCE_BIG_INT;
  }
}
