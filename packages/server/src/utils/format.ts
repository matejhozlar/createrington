export function formatBalance(balance: number | string): string {
  const numericValue =
    typeof balance === "string" ? parseFloat(balance) : balance;

  if (isNaN(numericValue)) {
    return "$0";
  }

  const floored = Math.floor(numericValue);
  const formatted = floored.toLocaleString("en-US");

  return `$${formatted}`;
}

export function formatDaysCount(days: number): string {
  return `${days} ${pluralize(days, "day")}`;
}

export function formatDuration(start: Date, end: Date = new Date()): string {
  const diffMs = end.getTime() - start.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds !== 1 ? "s" : ""}`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  if (diffHours < 24) {
    if (remainingMinutes === 0) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
    }
    return `${diffHours} hour${
      diffHours !== 1 ? "s" : ""
    } and ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (remainingHours === 0) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  }
  return `${diffDays} day${
    diffDays !== 1 ? "s" : ""
  } and ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
}

export function formatSeconds(seconds: number): string {
  return formatDuration(new Date(0), new Date(seconds * 1000));
}

export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function discordTimestamp(
  date: Date,
  style: "t" | "T" | "d" | "D" | "f" | "F" | "R" = "R",
): string {
  return `<t:${toUnixSeconds(date)}:${style}>`;
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  if (count === 1) {
    return singular;
  }
  return plural || `${singular}s`;
}
