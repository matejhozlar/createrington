import { useEffect, useRef } from "react";

export const SCROLL_PROGRESS_VAR = "--scroll-p";

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.style.setProperty(SCROLL_PROGRESS_VAR, "0");
    if (reduceMotion) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const range = element.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, window.scrollY / range));
      element.style.setProperty(SCROLL_PROGRESS_VAR, progress.toFixed(4));
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
