import { useEffect, useRef, type RefObject } from "react";

const TEXT_ENTRY_SELECTOR = "input, textarea, select, [contenteditable=true]";
const ACTIVATABLE_SELECTOR = "button, a, [role=tab]";
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function columnCount(grid: HTMLElement | null) {
  if (!grid) return 1;
  return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
}

export function useToolGridHotkeys(input: {
  gridRef: RefObject<HTMLElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  count: number;
  active: number | null;
  onMove: (index: number) => void;
  onOpen: (index: number) => void;
  onTogglePin: (index: number) => void;
  onClear: () => void;
}) {
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (document.querySelector(OVERLAY_SELECTOR)) return;

      const { gridRef, searchRef, count, active } = latest.current;
      const target = event.target instanceof Element ? event.target : null;
      const inSearch = target !== null && target === searchRef.current;
      if (!inSearch && target?.closest(TEXT_ENTRY_SELECTOR)) return;

      if (event.key === "Escape") {
        latest.current.onClear();
        return;
      }

      if (event.defaultPrevented) return;

      if (count === 0) return;

      const columns = columnCount(gridRef.current);
      const steps: Record<string, number | undefined> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: columns,
        ArrowUp: -columns,
      };
      const step = steps[event.key];
      if (step !== undefined) {
        event.preventDefault();
        const next =
          active === null ? 0 : Math.max(0, Math.min(count - 1, active + step));
        latest.current.onMove(next);
        const card = gridRef.current?.children[next];
        card?.scrollIntoView({ block: "nearest" });
        if (gridRef.current?.contains(document.activeElement)) {
          card?.querySelector("button")?.focus();
        }
        return;
      }

      if (active === null) return;

      if (event.key === "Enter") {
        if (!inSearch && target?.closest(ACTIVATABLE_SELECTOR)) return;
        event.preventDefault();
        latest.current.onOpen(active);
        return;
      }

      if (!inSearch && event.key.toLowerCase() === "p") {
        latest.current.onTogglePin(active);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
