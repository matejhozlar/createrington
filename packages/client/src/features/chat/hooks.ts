import { useEffect } from "react";

export function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows = 6,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.overflow = "hidden";
    el.style.height = "auto";

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const paddingY =
      parseFloat(getComputedStyle(el).paddingTop) +
      parseFloat(getComputedStyle(el).paddingBottom);
    const maxHeight = lineHeight * maxRows + paddingY;
    const capped = el.scrollHeight >= maxHeight;

    el.style.height = (capped ? maxHeight : el.scrollHeight) + "px";
    el.style.overflow = capped ? "auto" : "hidden";
  }, [value, ref, maxRows]);
}
