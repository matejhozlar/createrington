import { useSyncExternalStore } from "react";

export interface VisualViewportRect {
  height: number;
  offsetTop: number;
}

let snapshot: VisualViewportRect | null = null;

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

function getSnapshot(): VisualViewportRect | null {
  const viewport = window.visualViewport;
  if (!viewport) return null;
  const height = Math.round(viewport.height);
  const offsetTop = Math.round(viewport.offsetTop);
  if (
    !snapshot ||
    snapshot.height !== height ||
    snapshot.offsetTop !== offsetTop
  ) {
    snapshot = { height, offsetTop };
  }
  return snapshot;
}

function getServerSnapshot(): VisualViewportRect | null {
  return null;
}

export function useVisualViewport(): VisualViewportRect | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
