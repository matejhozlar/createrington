import { useCallback, useEffect, useState } from "react";
import { RANKS } from "../presets";
import {
  BACKDROPS,
  GUI_SCALES,
  type Backdrop,
  type GuiScale,
} from "../components/TabListPreview";

export type PreviewSettings = {
  guiScale: GuiScale;
  backdrop: Backdrop;
  rank: number;
};

const STORAGE_KEY = "team-prefix-preview";

const DEFAULT_SETTINGS: PreviewSettings = {
  guiScale: "3",
  backdrop: "night",
  rank: 0,
};

function readStoredSettings(): PreviewSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULT_SETTINGS;
    return {
      guiScale: GUI_SCALES.includes(stored.guiScale)
        ? stored.guiScale
        : DEFAULT_SETTINGS.guiScale,
      backdrop: BACKDROPS.some((option) => option.value === stored.backdrop)
        ? stored.backdrop
        : DEFAULT_SETTINGS.backdrop,
      rank:
        Number.isInteger(stored.rank) &&
        stored.rank >= 0 &&
        stored.rank < RANKS.length
          ? stored.rank
          : DEFAULT_SETTINGS.rank,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function usePreviewSettings() {
  const [settings, setSettings] = useState<PreviewSettings>(readStoredSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      return;
    }
  }, [settings]);

  const update = useCallback(
    (changes: Partial<PreviewSettings>) =>
      setSettings((current) => ({ ...current, ...changes })),
    [],
  );

  return { settings, update };
}
