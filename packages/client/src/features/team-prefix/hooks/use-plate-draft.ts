import { useCallback, useEffect, useState } from "react";
import {
  TAG_LENGTH,
  isPlateTag,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import { PLATE_PRESETS } from "../presets";

export type PlateDraft = {
  tag: string;
  plate: number;
  letters: number;
  plateFade: number;
  letterFade: number;
  plateFadeOn: boolean;
  letterFadeOn: boolean;
};

const STORAGE_KEY = "team-prefix-draft";

const DEFAULT_DRAFT: PlateDraft = {
  tag: "CRTN",
  plate: PLATE_PRESETS[0].plate,
  letters: PLATE_PRESETS[0].letters,
  plateFade: 0x8a5a1e,
  letterFade: 0x7a4a12,
  plateFadeOn: false,
  letterFadeOn: false,
};

export function sanitizeTag(value: string): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, TAG_LENGTH);
}

const isColor = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 0xffffff;

function readStoredDraft(): PlateDraft {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULT_DRAFT;
    const colors = ["plate", "letters", "plateFade", "letterFade"] as const;
    const flags = ["plateFadeOn", "letterFadeOn"] as const;
    if (
      typeof stored.tag !== "string" ||
      colors.some((key) => !isColor(stored[key])) ||
      flags.some((key) => typeof stored[key] !== "boolean")
    ) {
      return DEFAULT_DRAFT;
    }
    return {
      tag: sanitizeTag(stored.tag),
      plate: stored.plate,
      letters: stored.letters,
      plateFade: stored.plateFade,
      letterFade: stored.letterFade,
      plateFadeOn: stored.plateFadeOn,
      letterFadeOn: stored.letterFadeOn,
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

export function draftDesign(draft: PlateDraft): PlateDesign {
  return {
    style: "riveted",
    tag: draft.tag,
    plate: draft.plate,
    letters: draft.letters,
    plateFade: draft.plateFadeOn ? draft.plateFade : null,
    letterFade: draft.letterFadeOn ? draft.letterFade : null,
  };
}

export function isCompleteDraft(draft: PlateDraft): boolean {
  return isPlateTag(draft.tag);
}

export function usePlateDraft() {
  const [draft, setDraft] = useState<PlateDraft>(readStoredDraft);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      return;
    }
  }, [draft]);

  const update = useCallback(
    (changes: Partial<PlateDraft>) =>
      setDraft((current) => ({ ...current, ...changes })),
    [],
  );

  const load = useCallback(
    (design: PlateDesign) =>
      setDraft((current) => ({
        tag: design.tag,
        plate: design.plate,
        letters: design.letters,
        plateFade: design.plateFade ?? current.plateFade,
        letterFade: design.letterFade ?? current.letterFade,
        plateFadeOn: design.plateFade !== null,
        letterFadeOn: design.letterFade !== null,
      })),
    [],
  );

  return { draft, update, load };
}
