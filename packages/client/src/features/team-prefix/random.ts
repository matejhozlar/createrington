import {
  TAG_LENGTH,
  blendColor,
  PLATE_WIDTH,
} from "@createrington/shared/team-prefix";
import type { PlateDraft } from "./hooks/use-plate-draft";

const FADE_CHANCE = 0.6;
const MIN_CONTRAST = 3;
const ATTEMPTS = 500;
const PLATE_SAMPLES = [0, 8, 15, 22, PLATE_WIDTH - 1];

type RandomColors = Pick<
  PlateDraft,
  | "plate"
  | "letters"
  | "plateFade"
  | "letterFade"
  | "plateFadeOn"
  | "letterFadeOn"
>;

function randomUnit(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

function randomColor(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] & 0xffffff;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: number): number {
  return (
    0.2126 * channel((rgb >> 16) & 0xff) +
    0.7152 * channel((rgb >> 8) & 0xff) +
    0.0722 * channel(rgb & 0xff)
  );
}

function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function readable(colors: RandomColors): boolean {
  const plates = PLATE_SAMPLES.map((x) =>
    blendColor(
      colors.plate,
      colors.plateFadeOn ? colors.plateFade : null,
      x,
      PLATE_WIDTH,
    ),
  );
  const letters = Array.from({ length: TAG_LENGTH }, (_, i) =>
    blendColor(
      colors.letters,
      colors.letterFadeOn ? colors.letterFade : null,
      i,
      TAG_LENGTH,
    ),
  );
  return plates.every((plate) =>
    letters.every((letter) => contrast(plate, letter) >= MIN_CONTRAST),
  );
}

function roll(): RandomColors {
  return {
    plate: randomColor(),
    letters: randomColor(),
    plateFade: randomColor(),
    letterFade: randomColor(),
    plateFadeOn: randomUnit() < FADE_CHANCE,
    letterFadeOn: randomUnit() < FADE_CHANCE,
  };
}

export function randomColors(): RandomColors {
  let colors = roll();
  for (let i = 1; i < ATTEMPTS && !readable(colors); i++) colors = roll();
  if (readable(colors)) return colors;
  const letters = luminance(colors.plate) > 0.18 ? 0x000000 : 0xffffff;
  return { ...colors, letters, plateFadeOn: false, letterFadeOn: false };
}
