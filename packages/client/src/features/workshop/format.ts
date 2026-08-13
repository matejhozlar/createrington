import type { WorkshopModStatus } from "@createrington/shared/db";
import {
  WORKSHOP_MOD_STATUSES,
  WORKSHOP_MOD_STATUS_LABELS,
} from "@createrington/shared/workshop";

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

export function retryUnlessForbidden(
  failureCount: number,
  error: { data?: { code?: string } | null },
): boolean {
  return error.data?.code !== "FORBIDDEN" && failureCount < 3;
}

export function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
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

const MOD_STATUS_CLASSES: Record<WorkshopModStatus, string> = {
  pending: "border-primary/20 bg-primary/10 text-primary",
  approved: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  testing: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  next_update: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  in_pack: "border-green-500/20 bg-green-500/10 text-green-400",
  rejected: "border-red-500/20 bg-red-500/10 text-red-400",
};

const MOD_STATUS_TABLE_LABELS: Record<WorkshopModStatus, string> = {
  pending: "In review",
  approved: "Approved",
  testing: "In testing",
  next_update: "Next update",
  in_pack: "In pack",
  rejected: "Ruled out",
};

export const MOD_STATUS_STYLES = Object.fromEntries(
  WORKSHOP_MOD_STATUSES.map((status) => [
    status,
    {
      label: WORKSHOP_MOD_STATUS_LABELS[status],
      tableLabel: MOD_STATUS_TABLE_LABELS[status],
      className: MOD_STATUS_CLASSES[status],
    },
  ]),
) as Record<
  WorkshopModStatus,
  { label: string; tableLabel: string; className: string }
>;

// liveInVersion comes from the project's pack row, so it describes this
// suggestion only once the suggestion itself is the one that shipped
export function liveTitle(mod: {
  status: WorkshopModStatus;
  liveInVersion?: string | null;
}) {
  return mod.status === "in_pack" && mod.liveInVersion
    ? `Live since ${mod.liveInVersion}`
    : undefined;
}

export const DEPENDENCY_COVERAGE_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  published: {
    label: "In the pack",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  staged: {
    label: "Coming next update",
    className: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  },
  in_review: {
    label: "In review",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  rejected: {
    label: "Ruled out",
    className: "border-red-500/20 bg-red-500/10 text-red-400",
  },
  missing: {
    label: "Not in the workshop",
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  },
};

export function dependencyIsCovered(coverage: string): boolean {
  return coverage === "published" || coverage === "staged";
}

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
  locked: {
    label: "Locked",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
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
