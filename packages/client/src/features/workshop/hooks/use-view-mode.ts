import { useState } from "react";
import type { ViewMode } from "../components/ViewToggle";

export function useViewMode(storageKey: string) {
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem(storageKey) === "grid" ? "grid" : "list",
  );

  const changeView = (next: ViewMode) => {
    localStorage.setItem(storageKey, next);
    setView(next);
  };

  return [view, changeView] as const;
}
