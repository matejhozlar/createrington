import { useCallback, useEffect, useState } from "react";
import {
  BACKDROPS,
  GUI_SCALES,
  RANKS,
  type Backdrop,
  type GuiScale,
} from "../presets";
import { localStore } from "@/lib/storage";

export type PreviewSettings = {
  guiScale: GuiScale;
  backdrop: Backdrop;
  rank: number;
};

const STORAGE_KEY = "team-tag-preview";

const DEFAULT_SETTINGS: PreviewSettings = {
  guiScale: "3",
  backdrop: "night",
  rank: 0,
};

function readStoredSettings(): PreviewSettings {
  const stored = localStore.getJson(
    STORAGE_KEY,
  ) as Partial<PreviewSettings> | null;
  if (!stored || typeof stored !== "object") return DEFAULT_SETTINGS;
  const rank = stored.rank ?? -1;
  return {
    guiScale:
      GUI_SCALES.find((scale) => scale === stored.guiScale) ??
      DEFAULT_SETTINGS.guiScale,
    backdrop:
      BACKDROPS.find((option) => option.value === stored.backdrop)?.value ??
      DEFAULT_SETTINGS.backdrop,
    rank:
      Number.isInteger(rank) && rank >= 0 && rank < RANKS.length
        ? rank
        : DEFAULT_SETTINGS.rank,
  };
}

export function usePreviewSettings() {
  const [settings, setSettings] = useState<PreviewSettings>(readStoredSettings);

  useEffect(() => {
    localStore.setJson(STORAGE_KEY, settings);
  }, [settings]);

  const update = useCallback(
    (changes: Partial<PreviewSettings>) =>
      setSettings((current) => ({ ...current, ...changes })),
    [],
  );

  return { settings, update };
}
