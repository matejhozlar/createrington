import {
  PLATE_NAME_GAP,
  PLATE_WIDTH,
  plateColumn,
  plateColumnColor,
  plateLetterColor,
  plateLetterStart,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import type { PlateAssets } from "./assets";
import type { GlyphOp } from "./framebuffer";

export type TextLine = {
  ops: GlyphOp[];
  width: number;
};

export const PLATE_ADVANCE = PLATE_WIDTH + PLATE_NAME_GAP;

export function plateOps(design: PlateDesign, assets: PlateAssets): GlyphOp[] {
  const ops: GlyphOp[] = [];
  for (let x = 0; x < PLATE_WIDTH; x++) {
    ops.push({
      glyph: assets.plateColumns[plateColumn(x)],
      x,
      color: plateColumnColor(design, x),
    });
  }
  let x = plateLetterStart(design.tag);
  [...design.tag].forEach((char, i) => {
    const glyph = assets.plateLetters.get(char);
    if (!glyph) return;
    ops.push({ glyph, x, color: plateLetterColor(design, i) });
    x += glyph.advance;
  });
  return ops;
}

export function vanillaOps(
  text: string,
  color: number,
  assets: PlateAssets,
  start: number,
): TextLine {
  const ops: GlyphOp[] = [];
  let x = start;
  for (const char of text) {
    const glyph = assets.vanilla.get(char) ?? assets.vanilla.get("?")!;
    ops.push({ glyph, x, color });
    x += glyph.advance;
  }
  return { ops, width: x };
}

export function tabNameLine(
  name: string,
  nameColor: number,
  design: PlateDesign | null,
  assets: PlateAssets,
): TextLine {
  const plate = design ? plateOps(design, assets) : [];
  const text = vanillaOps(name, nameColor, assets, design ? PLATE_ADVANCE : 0);
  return { ops: [...plate, ...text.ops], width: text.width };
}
