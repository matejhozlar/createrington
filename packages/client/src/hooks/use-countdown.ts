import { useEffect, useState } from "react";
import { formatCountdown } from "@/features/crypto/format";

/**
 * Returns a formatted countdown string that ticks every second.
 * Returns null if no target date is provided, or "Ended" when elapsed.
 */
export function useCountdown(targetDate: string | null): string | null {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) return null;
  return formatCountdown(new Date(targetDate).getTime() - now);
}
