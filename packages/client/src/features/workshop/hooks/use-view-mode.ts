import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ViewMode } from "../components/ViewToggle";

export function useViewMode(storageKey: string) {
  const isMobile = useIsMobile();
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

  return [isMobile ? "grid" : view, changeView] as const;
}
