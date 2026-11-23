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

export function formatCount(
  count: number,
  singular: string,
  plural?: string,
): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}

function withRemainder(main: string, remainder: number, unit: string): string {
  return remainder === 0 ? main : `${main} and ${formatCount(remainder, unit)}`;
}

export function formatDuration(start: Date, end: Date = new Date()): string {
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (seconds < 60) return formatCount(seconds, "second");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatCount(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return withRemainder(formatCount(hours, "hour"), minutes % 60, "minute");
  }

  return withRemainder(
    formatCount(Math.floor(hours / 24), "day"),
    hours % 24,
    "hour",
  );
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
