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
  it("redeems a freshly issued code for its payload", async () => {
    const code = (await issueSsoCode(payload))!;
    expect(await consumeSsoCode(code)).toEqual(payload);
  });

  it("is single-use: a second redemption misses", async () => {
    const code = (await issueSsoCode(payload))!;
    expect(await consumeSsoCode(code)).toEqual(payload);
    expect(await consumeSsoCode(code)).toBeNull();
  });

  it("returns null for an unknown code", async () => {
    expect(await consumeSsoCode("deadbeef")).toBeNull();
  });

  it("expires codes after the 60s TTL", async () => {
    vi.useFakeTimers();
    const code = (await issueSsoCode(payload))!;
    vi.advanceTimersByTime(60_001);
    expect(await consumeSsoCode(code)).toBeNull();
  });

  it("still redeems just before the TTL elapses", async () => {
    vi.useFakeTimers();
    const code = (await issueSsoCode(payload))!;
    vi.advanceTimersByTime(59_000);
    expect(await consumeSsoCode(code)).toEqual(payload);
  });

  it("issues distinct codes for separate payloads", async () => {
    const a = (await issueSsoCode({ ...payload, minecraftUsername: "Alex" }))!;
    const b = (await issueSsoCode({ ...payload, minecraftUsername: "Notch" }))!;
    expect(a).not.toBe(b);
    expect((await consumeSsoCode(a))?.minecraftUsername).toBe("Alex");
    expect((await consumeSsoCode(b))?.minecraftUsername).toBe("Notch");
  });
});
