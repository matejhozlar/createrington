import { describe, it, expect, vi, afterEach } from "vitest";
import {
  issueSsoCode,
  consumeSsoCode,
  type SsoCodePayload,
} from "@/services/auth/sso/code-store";

const payload: SsoCodePayload = {
  playerId: "11111111-2222-3333-4444-555555555555",
  minecraftUsername: "Steve",
  isMember: true,
  isOwner: false,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("sso code-store", () => {
  it("redeems a freshly issued code for its payload", () => {
    const code = issueSsoCode(payload);
    expect(consumeSsoCode(code)).toEqual(payload);
  });

  it("is single-use: a second redemption misses", () => {
    const code = issueSsoCode(payload);
    expect(consumeSsoCode(code)).toEqual(payload);
    expect(consumeSsoCode(code)).toBeNull();
  });

  it("returns null for an unknown code", () => {
    expect(consumeSsoCode("deadbeef")).toBeNull();
  });

  it("expires codes after the 60s TTL", () => {
    vi.useFakeTimers();
    const code = issueSsoCode(payload);
    vi.advanceTimersByTime(60_001);
    expect(consumeSsoCode(code)).toBeNull();
  });

  it("still redeems just before the TTL elapses", () => {
    vi.useFakeTimers();
    const code = issueSsoCode(payload);
    vi.advanceTimersByTime(59_000);
    expect(consumeSsoCode(code)).toEqual(payload);
  });

  it("issues distinct codes for separate payloads", () => {
    const a = issueSsoCode({ ...payload, minecraftUsername: "Alex" });
    const b = issueSsoCode({ ...payload, minecraftUsername: "Notch" });
    expect(a).not.toBe(b);
    expect(consumeSsoCode(a)?.minecraftUsername).toBe("Alex");
    expect(consumeSsoCode(b)?.minecraftUsername).toBe("Notch");
  });
});
