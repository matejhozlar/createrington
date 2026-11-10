import type {
  ModEnvironment,
  ModEnvironmentSource,
  WorkshopModStatus,
} from "@createrington/shared/db";
import {
  CURSEFORGE_CLASSES,
  curseforgeClassLabel,
  MOD_ENVIRONMENTS,
  MOD_ENVIRONMENT_LABELS,
  WORKSHOP_MOD_STATUSES,
  WORKSHOP_MOD_STATUS_LABELS,
} from "@createrington/shared/workshop";
import type { BadgeTone } from "@/components/ui/badge";

export { WORKSHOP_MOD_REJECT_REASON_LABELS as REJECT_REASON_LABELS } from "@createrington/shared/workshop";
export { formatDate } from "@createrington/shared/format";

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

export function projectKindLabel(classId: number): string | null {
  return classId === CURSEFORGE_CLASSES.mods
    ? null
    : curseforgeClassLabel(classId);
}

export const COMPACT_BADGE_CLASS = "shrink-0 px-1.5 py-0 text-[10px]";

export const DISABLED_LABEL = "Disabled";

export function modCredit(submitterName: string | null) {
  return { verb: "Suggested by", name: submitterName ?? "a player" };
}

const MOD_STATUS_TONES: Record<WorkshopModStatus, BadgeTone> = {
  pending: "primary",
  approved: "info",
  testing: "warning",
  next_update: "violet",
  in_pack: "success",
  rejected: "danger",
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
      tone: MOD_STATUS_TONES[status],
    },
  ]),
) as Record<
  WorkshopModStatus,
  { label: string; tableLabel: string; tone: BadgeTone }
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

const MOD_ENVIRONMENT_TONES: Record<ModEnvironment, BadgeTone> = {
  client: "info",
  server: "orange",
  both: "teal",
  unspecified: "danger",
};

export const MOD_ENVIRONMENT_STYLES = Object.fromEntries(
  MOD_ENVIRONMENTS.map((environment) => [
    environment,
    {
      label: MOD_ENVIRONMENT_LABELS[environment],
      tone: MOD_ENVIRONMENT_TONES[environment],
    },
  ]),
) as Record<ModEnvironment, { label: string; tone: BadgeTone }>;

export function environmentTitle(
  environment: ModEnvironment,
  source: ModEnvironmentSource | null,
): string {
  if (environment === "unspecified") {
    return "Not classified yet, treated as Client & Server";
  }
  if (source === "manual") return "Set manually";
  if (source === "manifest") {
    return "From CurseForge, confirmed by the published pack";
  }
  if (source === "cf_flag") {
    return "From CurseForge, author-assigned and unverified";
  }
  return "Source unknown";
}

export const DEPENDENCY_COVERAGE_STYLES: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  published: {
    label: "In the pack",
    tone: "success",
  },
  staged: {
    label: "Coming next update",
    tone: "violet",
  },
  in_review: {
    label: "In review",
    tone: "primary",
  },
  rejected: {
    label: "Ruled out",
    tone: "danger",
  },
  missing: {
    label: "Not in the workshop",
    tone: "neutral",
  },
};

export function dependencyIsCovered(coverage: string): boolean {
  return coverage === "published" || coverage === "staged";
}

export const WORKSHOP_STATUS_STYLES: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  draft: {
    label: "Draft",
    tone: "warning",
  },
  open: {
    label: "Open",
    tone: "success",
  },
  closed: {
    label: "Closed",
    tone: "neutral",
  },
  archived: {
    label: "Archived",
    tone: "danger",
  },
};
