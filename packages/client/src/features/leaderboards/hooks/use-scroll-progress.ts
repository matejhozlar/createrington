import { useEffect, useRef } from "react";

const PHASE_SPLIT = 0.4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function writeProgress(element: HTMLElement, progress: number) {
  element.style.setProperty("--scroll-p", progress.toFixed(4));
  element.style.setProperty(
    "--scroll-a",
    clamp01(progress / PHASE_SPLIT).toFixed(4),
  );
  element.style.setProperty(
    "--scroll-b",
    clamp01((progress - PHASE_SPLIT) / (1 - PHASE_SPLIT)).toFixed(4),
  );
}

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    writeProgress(element, 0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const range = element.offsetHeight || 1;
      writeProgress(element, clamp01(window.scrollY / range));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return ref;
}
