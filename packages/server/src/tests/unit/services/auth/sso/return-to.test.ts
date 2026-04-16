import { describe, it, expect } from "vitest";
import { makeReturnToValidator } from "@/services/auth/sso/return-to";

const validator = makeReturnToValidator([
  "^https://[a-z0-9-]+\\.create-rington\\.com(/.*)?$",
  "^https://create-rington\\.com(/.*)?$",
]);

describe("validateReturnTo", () => {
  it("accepts an https URL on a whitelisted subdomain", () => {
    expect(validator("https://sandbox.create-rington.com")).toBe(
      "https://sandbox.create-rington.com",
    );
    expect(validator("https://panel.create-rington.com/dashboard")).toBe(
      "https://panel.create-rington.com/dashboard",
    );
  });

  it("accepts the apex domain when whitelisted", () => {
    expect(validator("https://create-rington.com/landing")).toBe(
      "https://create-rington.com/landing",
    );
  });

  it("rejects http (no downgrade attacks)", () => {
    expect(validator("http://sandbox.create-rington.com")).toBeNull();
  });

  it("rejects URLs that no whitelist pattern matches", () => {
    expect(validator("https://attacker.example.com")).toBeNull();
    expect(
      validator("https://create-rington.com.attacker.example.com"),
    ).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(validator("not-a-url")).toBeNull();
    expect(validator("//create-rington.com")).toBeNull();
  });

  it("rejects undefined / empty input", () => {
    expect(validator(undefined)).toBeNull();
    expect(validator("")).toBeNull();
  });

  it("rejects javascript: and data: URLs", () => {
    expect(validator("javascript:alert(1)")).toBeNull();
    expect(validator("data:text/html,<script>")).toBeNull();
  });
});
