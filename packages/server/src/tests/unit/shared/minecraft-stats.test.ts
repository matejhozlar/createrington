import { describe, it, expect } from "vitest";
import {
  decodeStatParam,
  encodeStatParam,
} from "@createrington/shared/minecraft-stats";

describe("encodeStatParam / decodeStatParam", () => {
  it.each([
    [
      { category: "minecraft:mined", item: "minecraft:diamond_ore" },
      "mined/diamond_ore",
    ],
    [
      { category: "minecraft:mined", item: "create:zinc_ore" },
      "mined/create:zinc_ore",
    ],
    [
      { category: "minecraft:custom", item: "minecraft:walk_one_cm" },
      "custom/walk_one_cm",
    ],
  ])("round-trips %o through %s", (stat, encoded) => {
    expect(encodeStatParam(stat)).toBe(encoded);
    expect(decodeStatParam(encoded)).toEqual(stat);
  });

  it.each([null, undefined, "", "mined", "/x", "mined/"])(
    "decodes %o to null",
    (value) => {
      expect(decodeStatParam(value)).toBeNull();
    },
  );
});
