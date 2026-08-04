import type { WorkshopModRejectReason } from "@createrington/shared/db";

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

export function agoLabel(value: string | Date): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
  );
  return days === 0 ? "today" : `${days}d ago`;
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
  approved: {
    label: "Approved",
    className: "border-green-500/50 bg-green-500/10 text-green-400",
  },
  pending: {
    label: "Pending review",
    className: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-500/50 bg-red-500/10 text-red-400",
  },
};

export const REJECT_REASON_LABELS: Record<WorkshopModRejectReason, string> = {
  on_hold: "On hold",
  incompatible: "Incompatible",
  covered_by_other_mod: "Covered by another mod",
  not_a_good_fit: "Not a good fit",
};
