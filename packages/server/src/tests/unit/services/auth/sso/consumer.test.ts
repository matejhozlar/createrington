import { describe, it, expect } from "vitest";
import {
  isCodeExchangeReturnTo,
  resolveConsumerName,
} from "@/services/auth/sso/consumer";

describe("sso consumer name resolution", () => {
  it("maps known subdomains to product names", () => {
    expect(resolveConsumerName("https://sandbox.createrington.com/x")).toBe(
      "Sandbox",
    );
    expect(resolveConsumerName("https://panel.createrington.com/x")).toBe(
      "Panel",
    );
    expect(resolveConsumerName("https://api.createrington.com/x")).toBe(
      "Skin API",
    );
  });

  it("title-cases an unknown leading label", () => {
    expect(resolveConsumerName("https://forum.example.com/x")).toBe("Forum");
  });

  it("falls back gracefully for an unparseable return_to", () => {
    expect(resolveConsumerName("not a url")).toBe("the requesting app");
  });
});

describe("isCodeExchangeReturnTo", () => {
  it("returns false for an unparseable return_to", () => {
    expect(isCodeExchangeReturnTo("not a url")).toBe(false);
  });

  it("returns false for an origin not in the code-exchange allowlist", () => {
    expect(isCodeExchangeReturnTo("https://sandbox.createrington.com/x")).toBe(
      false,
    );
  });
});
