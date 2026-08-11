import { useEffect, useRef } from "react";
import { WORKSHOP_TAB_IDS, type WorkshopTabId } from "../tabs";

const BLOCKING_SELECTOR =
  "input, textarea, select, [contenteditable=true], [role=dialog], [role=listbox], [role=menu], [role=combobox]";

export function useWorkshopHotkeys(input: {
  activeTab: WorkshopTabId;
  onTabChange: (tab: WorkshopTabId) => void;
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
        const index = WORKSHOP_TAB_IDS.indexOf(latest.current.activeTab);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const count = WORKSHOP_TAB_IDS.length;
        latest.current.onTabChange(
          WORKSHOP_TAB_IDS[(index + delta + count) % count],
        );
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
