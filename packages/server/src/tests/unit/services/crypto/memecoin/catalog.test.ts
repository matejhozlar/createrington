import { describe, it, expect } from "vitest";
import { MEMECOIN_CATALOG } from "@/services/crypto/memecoin/catalog";

describe("MEMECOIN_CATALOG", () => {
  it("is non-empty", () => {
    expect(MEMECOIN_CATALOG.length).toBeGreaterThan(0);
  });

  it("has unique symbols (case-sensitive)", () => {
    const symbols = MEMECOIN_CATALOG.map((m) => m.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("has unique names (case-sensitive)", () => {
    const names = MEMECOIN_CATALOG.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every entry has non-empty name, symbol, and description", () => {
    for (const m of MEMECOIN_CATALOG) {
      expect(m.name.trim().length).toBeGreaterThan(0);
      expect(m.symbol.trim().length).toBeGreaterThan(0);
      expect(m.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("symbols are uppercase letters/digits and 2–10 chars long", () => {
    // Stock-ticker style — keep this loose, but reject lowercase or bad chars
    for (const m of MEMECOIN_CATALOG) {
      expect(m.symbol).toMatch(/^[A-Z0-9]{2,10}$/);
    }
  });
});
