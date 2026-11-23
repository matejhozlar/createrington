import { useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { localStore } from "@/lib/storage";
import type { ViewMode } from "../components/ViewToggle";

export function useViewMode(storageKey: string) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewMode>(() =>
    localStore.get(storageKey) === "grid" ? "grid" : "list",
  );

  const changeView = (next: ViewMode) => {
    localStore.set(storageKey, next);
    setView(next);
  };

  return [isMobile ? "grid" : view, changeView] as const;
}
