import { useEffect, useRef, type RefObject } from "react";

const TEXT_ENTRY_SELECTOR = "input, textarea, select, [contenteditable=true]";
const ACTIVATABLE_SELECTOR = "button, a, [role=tab]";
const PAGE_REGION_SELECTOR = "[data-slot=sidebar-inset], [data-slot=sidebar]";
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function columnCount(grid: HTMLElement | null) {
  if (!grid) return 1;
  const tracks = getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter((track) => track.endsWith("px"));
  return tracks.length || 1;
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
    let keyboardInput = false;
    let keyboardFocus =
      document.activeElement?.matches(":focus-visible") ?? false;

    const onKeyDownCapture = () => {
      keyboardInput = true;
    };
    const onPointerDown = () => {
      keyboardInput = false;
    };
    const onFocusIn = () => {
      keyboardFocus = keyboardInput;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (document.querySelector(OVERLAY_SELECTOR)) return;

      const { gridRef, searchRef, count, active } = latest.current;
      const target = event.target instanceof Element ? event.target : null;
      const focused =
        target !== null && !target.contains(document.body) ? target : null;
      if (focused !== null && !focused.closest(PAGE_REGION_SELECTOR)) return;

      const inSearch = focused !== null && focused === searchRef.current;
      if (!inSearch && focused?.closest(TEXT_ENTRY_SELECTOR)) return;

      if (event.key === "Escape") {
        latest.current.onClear();
        return;
      }

      if (event.defaultPrevented) return;

      const inGrid =
        focused !== null && (gridRef.current?.contains(focused) ?? false);
      if (focused !== null && keyboardFocus && !inSearch && !inGrid) return;

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
        if (inGrid) card?.querySelector("button")?.focus();
        return;
      }

      if (active === null) return;

      if (event.key === "Enter") {
        if (!inSearch && focused?.closest(ACTIVATABLE_SELECTOR)) return;
        event.preventDefault();
        latest.current.onOpen(active);
        return;
      }

      if (!inSearch && event.key.toLowerCase() === "p") {
        latest.current.onTogglePin(active);
      }
    };

    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
