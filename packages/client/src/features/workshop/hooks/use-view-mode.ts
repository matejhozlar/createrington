import { useState } from "react";
import type { ViewMode } from "../components/ViewToggle";

export function useViewMode(storageKey: string) {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(storageKey) === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });

  const changeView = (next: ViewMode) => {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* storage-blocked contexts keep in-memory switching */
    }
    setView(next);
  };

  return [view, changeView] as const;
}
