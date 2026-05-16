import { useState } from "react";

/**
 * Returns the latest non-null value, keeping the previous one while the
 * current value is null. Used to keep dialog content rendered through
 * Radix's exit animation.
 */
export function useStickyValue<T>(value: T | null | undefined): T | null {
  const [sticky, setSticky] = useState<T | null>(value ?? null);
  if (value != null && value !== sticky) setSticky(value);
  return value ?? sticky;
}
