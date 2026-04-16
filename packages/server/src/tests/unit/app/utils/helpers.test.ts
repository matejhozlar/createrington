import { describe, it, expect } from "vitest";
import { getIdType, idToObject } from "@/app/utils/helpers";

describe("getIdType", () => {
  describe("Minecraft UUID", () => {
    it("detects a canonical lowercase UUID", () => {
      expect(getIdType("069a79f4-44e9-4726-a5be-fca90e38aaf5")).toBe(
        "minecraftUuid",
      );
    });

    it("is case-insensitive", () => {
      expect(getIdType("069A79F4-44E9-4726-A5BE-FCA90E38AAF5")).toBe(
        "minecraftUuid",
      );
    });

    it("rejects UUIDs missing dashes", () => {
      expect(getIdType("069a79f444e94726a5befca90e38aaf5")).not.toBe(
        "minecraftUuid",
      );
    });

    it("rejects UUIDs with non-hex characters", () => {
      expect(getIdType("069a79f4-44e9-4726-a5be-fca90e38aazz")).not.toBe(
        "minecraftUuid",
      );
    });
  });

  describe("Discord ID", () => {
    it("detects a 17-digit snowflake", () => {
      expect(getIdType("12345678901234567")).toBe("discord");
    });

    it("detects an 18-digit snowflake", () => {
      expect(getIdType("123456789012345678")).toBe("discord");
    });

    it("detects a 20-digit snowflake", () => {
      expect(getIdType("12345678901234567890")).toBe("discord");
    });

    it("rejects snowflakes shorter than 17 digits", () => {
      expect(getIdType("1234567890123456")).not.toBe("discord");
    });

    it("rejects snowflakes longer than 20 digits", () => {
      expect(getIdType("123456789012345678901")).toBe("invalid");
    });
  });

  describe("Minecraft username", () => {
    it("detects a 3-char username (minimum length)", () => {
      expect(getIdType("abc")).toBe("minecraftUsername");
    });

    it("detects a 16-char username (maximum length)", () => {
      expect(getIdType("abcdef0123456789")).toBe("minecraftUsername");
    });

    it("allows underscores", () => {
      expect(getIdType("Notch_2024")).toBe("minecraftUsername");
    });

    it("rejects usernames shorter than 3 chars", () => {
      expect(getIdType("ab")).toBe("invalid");
    });

    it("rejects usernames with disallowed characters", () => {
      expect(getIdType("with-dash")).toBe("invalid");
      expect(getIdType("with space")).toBe("invalid");
      expect(getIdType("emoji😀here")).toBe("invalid");
    });
  });

  describe("invalid input", () => {
    it("returns 'invalid' for an empty string", () => {
      expect(getIdType("")).toBe("invalid");
    });

    it("returns 'invalid' for usernames longer than 16 chars", () => {
      expect(getIdType("a".repeat(17))).toBe("invalid");
    });
  });

  describe("precedence", () => {
    it("prefers UUID over username for UUID-shaped strings", () => {
      // Canonical UUIDs contain dashes, so they can't also match the username regex,
      // but this guards against future regex tweaks.
      expect(getIdType("069a79f4-44e9-4726-a5be-fca90e38aaf5")).toBe(
        "minecraftUuid",
      );
    });

    it("prefers Discord over username for purely numeric 17–20 digit IDs", () => {
      // "12345678901234567" matches both the discord and username regexes shape-wise,
      // but the function should classify it as discord.
      expect(getIdType("12345678901234567")).toBe("discord");
    });
  });
});

describe("idToObject", () => {
  it("wraps a Minecraft UUID", () => {
    expect(idToObject("069a79f4-44e9-4726-a5be-fca90e38aaf5")).toEqual({
      minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
    });
  });

  it("wraps a Discord ID", () => {
    expect(idToObject("123456789012345678")).toEqual({
      discordId: "123456789012345678",
    });
  });

  it("wraps a Minecraft username", () => {
    expect(idToObject("Notch")).toEqual({ minecraftUsername: "Notch" });
  });

  it("returns null for invalid input", () => {
    expect(idToObject("")).toBeNull();
    expect(idToObject("not a valid id")).toBeNull();
  });
});
