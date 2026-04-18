import { describe, it, expect } from "vitest";
import { makeReturnToValidator } from "@/services/auth/sso/return-to";

const validator = makeReturnToValidator([
  "^https://[a-z0-9-]+\\.createrington\\.com(/.*)?$",
  "^https://createrington\\.com(/.*)?$",
]);

describe("validateReturnTo", () => {
  it("accepts an https URL on a whitelisted subdomain", () => {
    expect(validator("https://sandbox.createrington.com")).toBe(
      "https://sandbox.createrington.com",
    );
    expect(validator("https://panel.createrington.com/dashboard")).toBe(
      "https://panel.createrington.com/dashboard",
    );
  });

  it("accepts the apex domain when whitelisted", () => {
    expect(validator("https://createrington.com/landing")).toBe(
      "https://createrington.com/landing",
    );
  });

  it("rejects http (no downgrade attacks)", () => {
    expect(validator("http://sandbox.createrington.com")).toBeNull();
  });

  it("rejects URLs that no whitelist pattern matches", () => {
    expect(validator("https://attacker.example.com")).toBeNull();
    expect(
      validator("https://createrington.com.attacker.example.com"),
    ).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(validator("not-a-url")).toBeNull();
    expect(validator("//createrington.com")).toBeNull();
  });

  it("rejects undefined / empty input", () => {
    expect(validator(undefined)).toBeNull();
    expect(validator("")).toBeNull();
  });

  it("rejects javascript: and data: URLs", () => {
    expect(validator("javascript:alert(1)")).toBeNull();
    expect(validator("data:text/html,<script>")).toBeNull();
  });

  it("rejects URLs longer than 2048 chars (defense-in-depth ReDoS guard)", () => {
    const oversized = `https://sandbox.createrington.com/${"a".repeat(2048)}`;
    expect(validator(oversized)).toBeNull();
  });

  it("accepts URLs at exactly 2048 chars", () => {
    const prefix = "https://sandbox.createrington.com/";
    const padding = "a".repeat(2048 - prefix.length);
    const url = `${prefix}${padding}`;
    expect(url.length).toBe(2048);
    expect(validator(url)).toBe(url);
  });
});
