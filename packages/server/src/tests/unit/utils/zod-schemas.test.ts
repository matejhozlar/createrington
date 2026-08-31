import { describe, it, expect } from "vitest";
import { discordId, mcUuid } from "@/utils/zod-schemas";

describe("discordId", () => {
  it("accepts a 17-digit snowflake", () => {
    expect(discordId.safeParse("12345678901234567").success).toBe(true);
  });

  it("accepts a 20-digit snowflake", () => {
    expect(discordId.safeParse("12345678901234567890").success).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    const result = discordId.safeParse("  123456789012345678  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("123456789012345678");
    }
  });

  it("rejects inner whitespace", () => {
    expect(discordId.safeParse("12345678 012345678").success).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    expect(discordId.safeParse("   ").success).toBe(false);
  });

  it("rejects snowflakes shorter than 17 digits", () => {
    expect(discordId.safeParse("1234567890123456").success).toBe(false);
  });

  it("rejects snowflakes longer than 20 digits", () => {
    expect(discordId.safeParse("123456789012345678901").success).toBe(false);
  });

  it("rejects non-digit input", () => {
    expect(discordId.safeParse("12345678901234567a").success).toBe(false);
  });
});

describe("mcUuid", () => {
  it("accepts a standard UUID", () => {
    expect(
      mcUuid.safeParse("069a79f4-44e9-4726-a5be-fca90e38aaf5").success,
    ).toBe(true);
  });

  it("accepts non-RFC-4122 sentinel UUIDs", () => {
    expect(
      mcUuid.safeParse("00000000-0000-0000-0000-000000000001").success,
    ).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(
      mcUuid.safeParse("069A79F4-44E9-4726-A5BE-FCA90E38AAF5").success,
    ).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    const result = mcUuid.safeParse(" 069a79f4-44e9-4726-a5be-fca90e38aaf5 ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("069a79f4-44e9-4726-a5be-fca90e38aaf5");
    }
  });

  it("rejects undashed UUIDs", () => {
    expect(mcUuid.safeParse("069a79f444e94726a5befca90e38aaf5").success).toBe(
      false,
    );
  });

  it("rejects non-UUID input", () => {
    expect(mcUuid.safeParse("not-a-uuid").success).toBe(false);
  });
});
