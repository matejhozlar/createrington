/** Formats a price string with adaptive decimal precision based on magnitude. */
export function formatPrice(price: string | number): string {
  const num = Number(price);
  if (num === 0) return "0.00";
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Returns the percentage of total supply currently held by players. */
export function formatSupply(available: string, total: string): string {
  const avail = Number(available);
  const tot = Number(total);
  if (tot >= 999999999) return "∞";
  const percent = ((1 - avail / tot) * 100).toFixed(1);
  return `${percent}% held`;
}

/** Converts an ISO date string to a human-readable relative time label. */
export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Returns the percentage of total supply held by players as a number. */
export function getHeldPercent(available: string | number, total: string | number): number {
  const tot = Number(total);
  if (tot >= 999999999) return 0;
  const avail = Number(available);
  return Math.max(0, Math.min(100, (1 - avail / tot) * 100));
}

/** Formats remaining milliseconds as "Xh Ym" or "Ym Zs". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
