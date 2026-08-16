import type { PlayerPromptEntryModeValue } from "@createrington/shared/player-prompt";

export const DURATION_OPTIONS = [
  { value: "10m", label: "10 minutes", ms: 10 * 60 * 1000 },
  { value: "30m", label: "30 minutes", ms: 30 * 60 * 1000 },
  { value: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "3 days", ms: 3 * 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
];

export const ENTRY_MODE_OPTIONS = [
  {
    value: "single" as const,
    label: "Single entry",
    description:
      "Each player gets one answer they can edit until the prompt closes.",
  },
  {
    value: "multi" as const,
    label: "Multiple entries",
    description:
      "Each submission is kept as a separate entry. Earlier entries can't be edited.",
  },
];

export const COOLDOWN_OPTIONS = [
  { value: "1m", label: "1 minute", seconds: 60 },
  { value: "5m", label: "5 minutes", seconds: 5 * 60 },
  { value: "15m", label: "15 minutes", seconds: 15 * 60 },
  { value: "30m", label: "30 minutes", seconds: 30 * 60 },
  { value: "1h", label: "1 hour", seconds: 60 * 60 },
  { value: "6h", label: "6 hours", seconds: 6 * 60 * 60 },
  { value: "24h", label: "24 hours", seconds: 24 * 60 * 60 },
];

interface EntryRules {
  entryMode: PlayerPromptEntryModeValue;
  maxEntries: number | null;
  cooldownSeconds: number | null;
}

function unit(value: number, name: string): string {
  return `${value} ${name}${value === 1 ? "" : "s"}`;
}

// Mirrors the server's formatSeconds so the admin panel and the Discord card
// describe the same cooldown identically.
function formatCooldown(seconds: number): string {
  if (seconds < 60) return unit(seconds, "second");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return unit(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0
      ? unit(hours, "hour")
      : `${unit(hours, "hour")} and ${unit(remainingMinutes, "minute")}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours === 0
    ? unit(days, "day")
    : `${unit(days, "day")} and ${unit(remainingHours, "hour")}`;
}

export function describeEntryRules(rules: EntryRules): string {
  if (rules.entryMode === "single") {
    return "One answer per player, editable until the prompt closes";
  }
  const parts = [
    rules.maxEntries === null
      ? "Unlimited entries per player"
      : `Up to ${rules.maxEntries} entries per player`,
  ];
  if (rules.cooldownSeconds) {
    parts.push(`${formatCooldown(rules.cooldownSeconds)} between entries`);
  }
  return parts.join(" • ");
}
