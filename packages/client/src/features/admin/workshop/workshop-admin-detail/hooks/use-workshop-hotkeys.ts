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

function stepThrough<T>(
  list: readonly [T, ...T[]],
  index: number,
  delta: number,
): T {
  return list[(index + delta + list.length) % list.length] ?? list[0];
}

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
          latest.current.onTabChange(
            stepThrough(MOD_TAB_IDS, MOD_TAB_IDS.indexOf(active), delta),
          );
        } else {
          latest.current.onOpenGroup(
            stepThrough(
              TOP_TAB_IDS,
              TOP_TAB_IDS.indexOf(tabGroup(active)),
              delta,
            ),
          );
        }
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const group = TOP_TAB_IDS[Number(event.key) - 1];
        if (group) {
          event.preventDefault();
          latest.current.onOpenGroup(group);
        }
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
