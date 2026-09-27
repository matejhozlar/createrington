import { useEffect, useState } from "react";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function msUntilDisplayChange(ms: number): number {
  const unit = ms >= 3_600_000 ? 60_000 : 1000;
  return (ms % unit) + 1;
}

/**
 * Returns a formatted countdown string that re-renders only when the displayed value changes.
 * Returns null if no target date is provided, or "Ended" when elapsed.
 */
export function useCountdown(targetDate: string | null): string | null {
  const [now, setNow] = useState(Date.now);
  const target = targetDate ? new Date(targetDate).getTime() : null;

  useEffect(() => {
    if (target === null) return;
    const remaining = target - now;
    if (!(remaining > 0)) return;
    const nextChangeAt = now + msUntilDisplayChange(remaining);
    const id = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextChangeAt - Date.now()),
    );
    return () => clearTimeout(id);
  }, [target, now]);

  if (target === null) return null;
  return formatCountdown(target - now);
}
