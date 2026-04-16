import { describe, it, expect } from "vitest";
import {
  snakeToCamel,
  snakeToPascal,
  camelToSnake,
} from "@/scripts/db/utils/naming";

describe("snakeToCamel", () => {
  it("returns single-word strings unchanged", () => {
    expect(snakeToCamel("user")).toBe("user");
  });

  it("converts a single underscore", () => {
    expect(snakeToCamel("user_id")).toBe("userId");
  });

  it("converts multiple underscores", () => {
    expect(snakeToCamel("first_name_alt")).toBe("firstNameAlt");
    expect(snakeToCamel("created_at")).toBe("createdAt");
    expect(snakeToCamel("is_active")).toBe("isActive");
  });

  it("returns an empty string for empty input", () => {
    expect(snakeToCamel("")).toBe("");
  });

  it("does not transform underscores that aren't followed by a lowercase letter", () => {
    expect(snakeToCamel("user_1")).toBe("user_1");
    expect(snakeToCamel("user_")).toBe("user_");
  });

  it("only capitalizes after the underscore that immediately precedes a lowercase letter", () => {
    // The first '_' is followed by '_' (not [a-z]), so it stays as-is.
    // The second '_i' matches /_(i)/ and becomes 'I'.
    expect(snakeToCamel("user__id")).toBe("user_Id");
  });

  it("strips a leading underscore when followed by a lowercase letter", () => {
    // Documented quirk: a leading '_x' matches and becomes 'X', so the
    // underscore is consumed even at position 0.
    expect(snakeToCamel("_private_field")).toBe("PrivateField");
  });
});

describe("snakeToPascal", () => {
  it("capitalizes single words", () => {
    expect(snakeToPascal("user")).toBe("User");
  });

  it("capitalizes each underscore-separated segment", () => {
    expect(snakeToPascal("user_profile")).toBe("UserProfile");
    expect(snakeToPascal("oauth_token")).toBe("OauthToken");
    expect(snakeToPascal("api_rate_limit")).toBe("ApiRateLimit");
  });

  it("returns an empty string for empty input", () => {
    expect(snakeToPascal("")).toBe("");
  });

  it("preserves casing in already-capitalized segments", () => {
    expect(snakeToPascal("API_token")).toBe("APIToken");
  });

  it("collapses consecutive underscores into empty segments (which capitalize to empty)", () => {
    expect(snakeToPascal("user__profile")).toBe("UserProfile");
  });
});

describe("camelToSnake", () => {
  it("returns lowercase strings unchanged", () => {
    expect(camelToSnake("user")).toBe("user");
  });

  it("converts a single uppercase boundary", () => {
    expect(camelToSnake("userId")).toBe("user_id");
  });

  it("converts multiple uppercase boundaries", () => {
    expect(camelToSnake("createdAt")).toBe("created_at");
    expect(camelToSnake("isActive")).toBe("is_active");
    expect(camelToSnake("firstName")).toBe("first_name");
  });

  it("prefixes a leading capital with an underscore (PascalCase quirk)", () => {
    // The implementation inserts `_<lower>` for every uppercase letter,
    // so PascalCase input yields a leading underscore. This is the documented
    // current behavior; encoding it as a test guards against silent regressions.
    expect(camelToSnake("UserProfile")).toBe("_user_profile");
  });

  it("returns an empty string for empty input", () => {
    expect(camelToSnake("")).toBe("");
  });
});

describe("round-trip conversions", () => {
  const lowerCamels = ["user", "userId", "createdAt", "firstNameAlt"];

  it.each(lowerCamels)(
    "snakeToCamel(camelToSnake(%s)) is identity for lowerCamel input",
    (input) => {
      expect(snakeToCamel(camelToSnake(input))).toBe(input);
    },
  );

  const snakes = ["user", "user_id", "created_at", "first_name_alt"];

  it.each(snakes)(
    "camelToSnake(snakeToCamel(%s)) is identity for snake_case input",
    (input) => {
      expect(camelToSnake(snakeToCamel(input))).toBe(input);
    },
  );
});
