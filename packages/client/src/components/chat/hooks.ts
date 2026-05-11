import { useEffect, useState } from "react";

/**
 * Returns a `now` timestamp (ms) that updates every `intervalMs`.
 * The value is captured inside setInterval (an effect), so no impure call
 * happens during render: it's just reading state.
 */
export function useRelativeTick(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Auto-expanding textarea: grows with content, caps at maxRows
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
