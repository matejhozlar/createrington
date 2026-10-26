export const DESIGN_CODE_VERSION = "CRP1";
export const TAG_LENGTH = 4;
export const PLATE_WIDTH = 31;
export const PLATE_NAME_GAP = 3;

const PLATE_CONTENT_START = 4;
const PLATE_CONTENT_WIDTH = 23;

export const PLATE_STYLES = ["riveted"] as const;
export type PlateStyle = (typeof PLATE_STYLES)[number];

const STYLE_KEYS: Record<PlateStyle, string> = { riveted: "R" };

export type PlateDesign = {
  style: PlateStyle;
  tag: string;
  plate: number;
  letters: number;
  plateFade: number | null;
  letterFade: number | null;
};

export type PlateColumn = "edge" | "rivet" | "fill";

export class DesignCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignCodeError";
  }
}

const TAG = new RegExp(`^[A-Za-z0-9]{${TAG_LENGTH}}$`);
const HEX = /^[0-9A-Fa-f]{6}$/;

export function isPlateTag(tag: string): boolean {
  return TAG.test(tag);
}

function styleByKey(key: string): PlateStyle | null {
  return (
    PLATE_STYLES.find(
      (style) => STYLE_KEYS[style].toLowerCase() === key.toLowerCase(),
    ) ?? null
  );
}

function parseColor(value: string, what: string): number {
  if (!HEX.test(value)) {
    throw new DesignCodeError(`The ${what} colour ${value} is not RRGGBB.`);
  }
  return parseInt(value, 16);
}

export function colorHex(rgb: number): string {
  return rgb.toString(16).toUpperCase().padStart(6, "0");
}

export function parseDesignCode(code: string): PlateDesign {
  const parts = code.trim().split(":");
  const [
    version = "",
    styleKey = "",
    tag = "",
    plateHex = "",
    lettersHex = "",
    ...extras
  ] = parts;
  if (
    parts.length < 5 ||
    version.toUpperCase() !== DESIGN_CODE_VERSION.toUpperCase()
  ) {
    throw new DesignCodeError(
      `Not a plate design code. It looks like ${DESIGN_CODE_VERSION}:R:TAG:RRGGBB:RRGGBB.`,
    );
  }
  const style = styleByKey(styleKey);
  if (!style) {
    throw new DesignCodeError(`Unknown plate style ${styleKey}.`);
  }
  if (!isPlateTag(tag)) {
    throw new DesignCodeError(
      `Tags are exactly ${TAG_LENGTH} letters or digits.`,
    );
  }
  const plate = parseColor(plateHex, "plate");
  const letters = parseColor(lettersHex, "letter");
  let plateFade: number | null = null;
  let letterFade: number | null = null;
  for (const part of extras) {
    const kind = part.charAt(0).toLowerCase();
    if (kind === "p" && plateFade === null) {
      plateFade = parseColor(part.slice(1), "plate fade");
    } else if (kind === "l" && letterFade === null) {
      letterFade = parseColor(part.slice(1), "letter fade");
    } else {
      throw new DesignCodeError(`Unexpected part ${part} in the design code.`);
    }
  }
  return {
    style,
    tag: tag.toUpperCase(),
    plate,
    letters,
    plateFade,
    letterFade,
  };
}

export function designCode(design: PlateDesign): string {
  let code = [
    DESIGN_CODE_VERSION,
    STYLE_KEYS[design.style],
    design.tag.toUpperCase(),
    colorHex(design.plate),
    colorHex(design.letters),
  ].join(":");
  if (design.plateFade !== null) code += `:p${colorHex(design.plateFade)}`;
  if (design.letterFade !== null) code += `:l${colorHex(design.letterFade)}`;
  return code;
}

export function blendColor(
  from: number,
  to: number | null,
  index: number,
  count: number,
): number {
  if (to === null || count < 2) return from;
  const t = index / (count - 1);
  let rgb = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    rgb |= Math.round(a + (b - a) * t) << shift;
  }
  return rgb;
}

export function plateColumn(x: number): PlateColumn {
  if (x === 0 || x === PLATE_WIDTH - 1) return "edge";
  if (x === 1 || x === PLATE_WIDTH - 2) return "rivet";
  return "fill";
}

export function plateColumnColor(design: PlateDesign, x: number): number {
  return blendColor(design.plate, design.plateFade, x, PLATE_WIDTH);
}

export function plateLetterColor(design: PlateDesign, index: number): number {
  return blendColor(
    design.letters,
    design.letterFade,
    index,
    design.tag.length,
  );
}

export function plateLetterWidth(char: string): number {
  switch (char.toUpperCase()) {
    case "I":
    case "0":
    case "1":
      return 3;
    case "M":
    case "T":
    case "V":
    case "W":
    case "Y":
      return 5;
    default:
      return 4;
  }
}

export function plateLetterStart(tag: string): number {
  const width = [...tag].reduce(
    (sum, char) => sum + plateLetterWidth(char) + 1,
    -1,
  );
  return PLATE_CONTENT_START + Math.floor((PLATE_CONTENT_WIDTH - width) / 2);
}
