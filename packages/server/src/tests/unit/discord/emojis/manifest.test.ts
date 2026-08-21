import { describe, expect, it } from "vitest";
import { emojiManifest, type EmojiDefinition } from "@/discord/emojis/manifest";
import { renderEmoji } from "@/discord/emojis/rasterize";
import { toScreamingSnakeCase } from "@/discord/constants/case";

/**
 * The emoji manifest is hand-written and only otherwise validated inside the
 * deploy job, which runs after merge alongside migrations and the app build. A
 * bad entry there aborts the whole deploy for a cosmetic asset, so every
 * deterministic failure mode is asserted here instead.
 */

// `as const satisfies` narrows each entry to its own literal shape, so widen
// back to the declared union to assert against optional fields
const entries = Object.entries(emojiManifest) as [string, EmojiDefinition][];

/**
 * Tighter than Discord's own `[A-Za-z0-9_]{2,32}`, deliberately.
 *
 * The runtime and type-level case converters disagree on consecutive capitals:
 * `toScreamingSnakeCase("myURL")` yields "MY_URL" because its regex only fires
 * on a lower-to-upper boundary, while `ToScreamingSnakeCase<"myURL">` evaluates
 * to "MY_U_R_L". That would produce a namespace key that exists in the types but
 * not at runtime. Lowercase keys cannot contain consecutive capitals, so the two
 * converters cannot diverge.
 */
const VALID_KEY = /^[a-z0-9_]{2,32}$/;

describe("emoji manifest", () => {
  it("has at least one entry", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  describe.each(entries)("%s", (name, definition) => {
    it("uses a Discord-legal, converter-safe name", () => {
      expect(name).toMatch(VALID_KEY);
    });

    it("survives the case conversion the namespace applies", () => {
      const converted = toScreamingSnakeCase(name);
      expect(converted).toBe(name.toUpperCase());
    });

    it("declares exactly one source", () => {
      const sources = [definition.icon, definition.file].filter(
        (source) => source !== undefined,
      );
      expect(sources).toHaveLength(1);
    });

    it("declares a non-empty unicode fallback", () => {
      expect(definition.fallback).toBeTruthy();
    });

    it("uses a hex tint when one is set", () => {
      if (definition.tint !== undefined) {
        expect(definition.tint).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it("renders to a Discord-acceptable image within the size limit", async () => {
      const { data, mime } = await renderEmoji(name, definition);

      // Magic numbers, so a silently-empty or mislabelled buffer cannot pass
      const magic: Record<string, number[]> = {
        "image/png": [0x89, 0x50, 0x4e, 0x47],
        "image/gif": [0x47, 0x49, 0x46, 0x38],
        "image/jpeg": [0xff, 0xd8, 0xff],
      };

      expect(Object.keys(magic)).toContain(mime);
      expect([...data.subarray(0, magic[mime]!.length)]).toEqual(magic[mime]);
      expect(data.length).toBeLessThanOrEqual(256 * 1024);
    });
  });

  it("produces unique namespace keys", () => {
    const keys = entries.map(([name]) => toScreamingSnakeCase(name));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
