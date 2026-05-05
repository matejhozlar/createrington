export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Mod-synced timestamps occasionally arrive as 0/epoch when the upstream
// value is unset. Treat anything before 2001 as "no real timestamp" so the
// UI doesn't render "1 Jan 1970".
function isMeaningfulDate(date: Date): boolean {
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 2001;
}

export function formatRelativeDateSafe(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (value == null) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!isMeaningfulDate(date)) return fallback;
  return formatRelativeDate(date.toISOString());
}

export function formatFullDateSafe(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (value == null) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!isMeaningfulDate(date)) return fallback;
  return formatFullDate(date.toISOString());
}
