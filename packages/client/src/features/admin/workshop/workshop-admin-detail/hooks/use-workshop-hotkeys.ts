import { useEffect, useRef } from "react";
import {
  MOD_TAB_IDS,
  TOP_TAB_IDS,
  isModTab,
  tabGroup,
  type TopTabId,
  type WorkshopTabId,
} from "../tabs";

const BLOCKING_SELECTOR =
  "input, textarea, select, [contenteditable=true], [role=dialog], [role=listbox], [role=menu], [role=combobox]";

export function useWorkshopHotkeys(input: {
  activeTab: WorkshopTabId;
  onTabChange: (tab: WorkshopTabId) => void;
  onOpenGroup: (group: TopTabId) => void;
}) {
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(BLOCKING_SELECTOR)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const active = latest.current.activeTab;
        if (isModTab(active)) {
          const index = MOD_TAB_IDS.indexOf(active);
          const count = MOD_TAB_IDS.length;
          latest.current.onTabChange(
            MOD_TAB_IDS[(index + delta + count) % count],
          );
        } else {
          const index = TOP_TAB_IDS.indexOf(tabGroup(active));
          const count = TOP_TAB_IDS.length;
          latest.current.onOpenGroup(
            TOP_TAB_IDS[(index + delta + count) % count],
          );
        }
        return;
      }

      const digit = Number.parseInt(event.key, 10);
      if (digit >= 1 && digit <= TOP_TAB_IDS.length && event.key.length === 1) {
        event.preventDefault();
        latest.current.onOpenGroup(TOP_TAB_IDS[digit - 1]);
        return;
      }

      if (event.key === "ArrowDown" && !target?.closest("tr[data-row-key]")) {
        const row = document.querySelector<HTMLElement>(
          "tr[data-row-key][tabindex]",
        );
        if (row) {
          event.preventDefault();
          row.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
