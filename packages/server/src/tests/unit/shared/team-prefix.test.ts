import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  DesignCodeError,
  PLATE_WIDTH,
  designCode,
  parseDesignCode,
  plateColumn,
  plateColumnColor,
  plateLetterColor,
  plateLetterStart,
  plateLetterWidth,
} from "@createrington/shared/team-prefix";

const LETTER_ROWS = ["ABCDEFGHIJKLMNOPQR", "STUVWXYZ0123456789"];
const PLATE_LETTERS_PNG = fileURLToPath(
  new URL(
    "../../../../../client/public/assets/team-prefix/plate_letters.png",
    import.meta.url,
  ),
);

function messageOf(code: string): string {
  try {
    parseDesignCode(code);
  } catch (error) {
    expect(error).toBeInstanceOf(DesignCodeError);
    return (error as Error).message;
  }
  throw new Error(`${code} was accepted`);
}

describe("parseDesignCode", () => {
  it("reads the tag, style and colours", () => {
    expect(parseDesignCode("CRP1:R:CRTN:D9A441:3B230E")).toEqual({
      style: "riveted",
      tag: "CRTN",
      plate: 0xd9a441,
      letters: 0x3b230e,
      plateFade: null,
      letterFade: null,
    });
  });

  it("reads the fades in either order", () => {
    const design = parseDesignCode("CRP1:R:GLOW:2D5B8A:FFE49A:lFFFFFF:p3FA37A");
    expect(design.plateFade).toBe(0x3fa37a);
    expect(design.letterFade).toBe(0xffffff);
  });

  it.each([
    ["CRP1:R:CRT:D9A441:3B230E", "Tags are exactly 4 letters or digits."],
    ["CRP1:R:CRTNX:D9A441:3B230E", "Tags are exactly 4 letters or digits."],
    ["CRP1:R:CR N:D9A441:3B230E", "Tags are exactly 4 letters or digits."],
    ["CRP1:X:CRTN:D9A441:3B230E", "Unknown plate style X."],
    ["CRP1:R:CRTN:#D9A441:3B230E", "The plate colour #D9A441 is not RRGGBB."],
    [
      "CRP1:R:CRTN:D9A441:3B230E:lFFF",
      "The letter fade colour FFF is not RRGGBB.",
    ],
    [
      "CRP1:R:CRTN:D9A441:3B230E:p445566:p112233",
      "Unexpected part p112233 in the design code.",
    ],
    [
      "CRP1:R:CRTN:D9A441:3B230E:x112233",
      "Unexpected part x112233 in the design code.",
    ],
  ])("refuses %s", (code, message) => {
    expect(messageOf(code)).toBe(message);
  });

  it.each([
    "PRLG dark_aqua",
    "CRP2:R:CRTN:D9A441:3B230E",
    "CRP1:R:CRTN:D9A441",
  ])("refuses %s as not a design code", (code) => {
    expect(messageOf(code)).toBe(
      "Not a plate design code. It looks like CRP1:R:TAG:RRGGBB:RRGGBB.",
    );
  });
});

describe("designCode", () => {
  it.each([
    [" crp1:r:crtn:d9a441:3b230e ", "CRP1:R:CRTN:D9A441:3B230E"],
    [
      "CRP1:R:glow:2d5b8a:ffe49a:LFFFFFF:P3fa37a",
      "CRP1:R:GLOW:2D5B8A:FFE49A:p3FA37A:lFFFFFF",
    ],
    [
      "CRP1:R:GLOW:2D5B8A:FFE49A:lFFFFFF:p3FA37A",
      "CRP1:R:GLOW:2D5B8A:FFE49A:p3FA37A:lFFFFFF",
    ],
  ])("writes %s back as %s", (code, canonical) => {
    expect(designCode(parseDesignCode(code))).toBe(canonical);
  });

  it("pads dark colours to six digits", () => {
    expect(
      designCode({
        style: "riveted",
        tag: "void",
        plate: 0x000102,
        letters: 0xffffff,
        plateFade: null,
        letterFade: 0x0000ff,
      }),
    ).toBe("CRP1:R:VOID:000102:FFFFFF:l0000FF");
  });
});

describe("plate layout", () => {
  it.each([
    ["MMMM", 4],
    ["IIII", 8],
    ["CRTN", 5],
  ])("centres %s from x = %i", (tag, start) => {
    expect(plateLetterStart(tag)).toBe(start);
  });

  it("puts edges and rivets at both ends of the fill", () => {
    const columns = Array.from({ length: PLATE_WIDTH }, (_, x) =>
      plateColumn(x),
    );
    expect(columns.slice(0, 2)).toEqual(["edge", "rivet"]);
    expect(columns.slice(-2)).toEqual(["rivet", "edge"]);
    expect(columns.slice(2, -2).every((column) => column === "fill")).toBe(
      true,
    );
  });

  it("fades the plate across its columns and the letters across the tag", () => {
    const design = parseDesignCode("CRP1:R:GLOW:000000:000000:pFFFFFF:lFFFFFF");
    expect(plateColumnColor(design, 0)).toBe(0x000000);
    expect(plateColumnColor(design, PLATE_WIDTH - 1)).toBe(0xffffff);
    expect([0, 1, 2, 3].map((i) => plateLetterColor(design, i))).toEqual([
      0x000000, 0x555555, 0xaaaaaa, 0xffffff,
    ]);
  });

  it("matches the letter widths of the pack jar font", async () => {
    const { data, info } = await sharp(PLATE_LETTERS_PNG)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cellWidth = info.width / LETTER_ROWS[0].length;
    const cellHeight = info.height / LETTER_ROWS.length;
    LETTER_ROWS.forEach((chars, row) => {
      [...chars].forEach((char, col) => {
        let width = 0;
        for (let x = 0; x < cellWidth; x++) {
          for (let y = 0; y < cellHeight; y++) {
            const px = col * cellWidth + x;
            const py = row * cellHeight + y;
            if (data[(py * info.width + px) * 4 + 3] !== 0) width = x + 1;
          }
        }
        expect(plateLetterWidth(char), char).toBe(width);
      });
    });
  });
});
