import {
  parseDesignCode,
  PLATE_WIDTH,
  type PlateDesign,
} from "@createrington/shared/team-tag";

export const PLATE_STRIP_WIDTH = PLATE_WIDTH + 1;
export const PLATE_STRIP_HEIGHT = 9;

export function parsePlateCode(code: string | null): PlateDesign | null {
  if (!code) return null;
  try {
    return parseDesignCode(code);
  } catch {
    return null;
  }
}
