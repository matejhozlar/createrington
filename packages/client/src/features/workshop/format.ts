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

export function modCredit(source: string, submitterName: string | null) {
  if (source === "dependency") {
    return { isAdmin: true, verb: "Pulled in as a", name: "dependency" };
  }
  const isAdmin = source === "admin";
  return {
    isAdmin,
    verb: isAdmin ? "Added by" : "Suggested by",
    name: submitterName ?? (isAdmin ? "an admin" : "a player"),
  };
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
