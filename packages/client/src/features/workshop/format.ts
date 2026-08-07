export { WORKSHOP_MOD_REJECT_REASON_LABELS as REJECT_REASON_LABELS } from "@createrington/shared/workshop";

export const LOADER_NAMES: Record<number, string> = {
  1: "Forge",
  4: "Fabric",
  5: "Quilt",
  6: "NeoForge",
};

export function loaderName(loaderType: number): string {
  return LOADER_NAMES[loaderType] ?? `Loader ${loaderType}`;
}

export function formatDownloads(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function modInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, "").charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "?";
}

export function projectCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  return categories.flatMap((category) =>
    typeof category?.name === "string" ? [category.name as string] : [],
  );
}

export function modCredit(submitterName: string | null) {
  return { verb: "Suggested by", name: submitterName ?? "a player" };
}

export const MOD_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "In review",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  approved: {
    label: "Approved",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  },
  rejected: {
    label: "Ruled out",
    className: "border-red-500/20 bg-red-500/10 text-red-400",
  },
  live: {
    label: "Live",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
};

export const WORKSHOP_STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  },
  open: {
    label: "Open",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  closed: {
    label: "Closed",
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  },
  archived: {
    label: "Archived",
    className: "border-red-500/20 bg-red-500/10 text-red-400",
  },
};
