import { useMemo, type ReactNode } from "react";
import { Package, Search } from "lucide-react";
import type { ModEnvironment } from "@createrington/shared/db";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { PagedTable } from "@/components/paged-table";
import { PlayerLabel } from "@/components/player-label";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { DISABLED_LABEL, projectKindLabel } from "@/features/workshop/format";
import {
  EnvironmentCell,
  type EnvironmentDisplay,
} from "@/features/workshop/components/EnvironmentCell";
import type { PackMod } from "@/features/admin/workshop/workshop-admin-detail/types";
import {
  ModCell,
  ModCellSkeleton,
} from "@/features/admin/workshop/workshop-admin-detail/components/ModCell";
import { PackCard } from "@/features/admin/workshop/workshop-admin-detail/components/in-pack/PackCard";

const MODS_PER_PAGE = 10;

const ORIGIN_LABELS: Record<PackMod["origin"], string> = {
  suggestion: "Suggestion",
  dependency: "Dependency",
  import: "Pack Import",
};

const PUBLISH_STATES = {
  live: {
    label: "Live",
    tone: "success",
  },
  dropped: {
    label: "Dropped",
    tone: "warning",
  },
  awaiting: {
    label: "Awaiting",
    tone: "neutral",
  },
} satisfies Record<string, { label: string; tone: BadgeTone }>;

const DESCRIPTIONS = {
  linked:
    "What the published CurseForge pack actually contains, read from its manifest. Mods staged for the next update appear here once you publish a build that includes them.",
  unlinked:
    "What the pack contains, seeded from an imported manifest.json. Once the pack is published on CurseForge, link its project to derive this automatically.",
} as const;

function publishState(row: PackMod) {
  if (row.liveAt) {
    return {
      ...PUBLISH_STATES.live,
      label: row.liveInVersion ?? PUBLISH_STATES.live.label,
      title: row.liveInVersion ? `Live in ${row.liveInVersion}` : undefined,
    };
  }
  const state = row.droppedFromManifestAt
    ? PUBLISH_STATES.dropped
    : PUBLISH_STATES.awaiting;
  return { ...state, title: undefined };
}

function Credit({ row }: { row: PackMod }) {
  if (row.origin === "suggestion") {
    return row.suggestedByName ? (
      <span className="flex items-center gap-1">
        Suggested by <PlayerLabel name={row.suggestedByName} size={16} />
      </span>
    ) : (
      "Suggested by a player"
    );
  }
  if (row.origin === "dependency") {
    return row.requiredBy.length > 0 ? (
      <CellText
        value={`Required by ${row.requiredBy.map((required) => required.name).join(", ")}`}
      />
    ) : (
      "Required dependency"
    );
  }
  return row.liveInVersion
    ? `Added with ${row.liveInVersion}`
    : "From the pack manifest";
}

export function CurrentPackTable({
  workshopId,
  rows,
  query,
  isLoading,
  error,
  onRetry,
  envDisplay,
  onSetEnvironment,
  unlinked,
  title,
  action,
}: {
  workshopId: number;
  rows: PackMod[];
  query: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  envDisplay: EnvironmentDisplay;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
  unlinked: boolean;
  title: string;
  action: ReactNode;
}) {
  const filtered = useMemo(() => {
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.project.name,
        row.project.slug,
        row.suggestedByName,
        projectKindLabel(row.project.classId),
        row.required ? null : DISABLED_LABEL,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [rows, query]);

  const paged = useClientPagination(filtered, {
    perPage: MODS_PER_PAGE,
    resetKey: [query],
    loading: isLoading,
    error,
    retry: onRetry,
  });

  const columns: DataTableColumn<PackMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
      skeleton: () => <ModCellSkeleton />,
      render: (row) => (
        <ModCell
          name={row.project.name}
          slug={row.project.slug}
          thumbnailUrl={row.project.thumbnailUrl}
          classId={row.project.classId}
          required={row.required}
        />
      ),
    },
    {
      key: "origin",
      header: "Origin",
      width: 140,
      cellClassName: "text-sm",
      render: (row) => {
        const otherWorkshop =
          row.suggestionWorkshopId !== null &&
          row.suggestionWorkshopId !== workshopId
            ? (row.suggestionWorkshopName ?? "another workshop")
            : null;
        return (
          <>
            <p>{ORIGIN_LABELS[row.origin]}</p>
            {otherWorkshop && (
              <CellText
                value={`from ${otherWorkshop}`}
                className="text-xs text-muted-foreground"
              />
            )}
          </>
        );
      },
    },
    {
      key: "credit",
      header: "Credit",
      minWidth: 180,
      cellClassName: "text-sm text-muted-foreground",
      render: (row) => <Credit row={row} />,
    },
    {
      key: "environment",
      header: "Environment",
      width: 140,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => (
        <EnvironmentCell
          projectId={row.project.id}
          environment={row.project.environment}
          source={row.project.environmentSource}
          display={envDisplay}
          onSetEnvironment={onSetEnvironment}
        />
      ),
    },
    {
      key: "publishState",
      header: "Publish State",
      width: 150,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => {
        const state = publishState(row);
        return (
          <Badge tone={state.tone} className="text-xs" title={state.title}>
            {state.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <PackCard
      title={title}
      count={rows.length}
      description={unlinked ? DESCRIPTIONS.unlinked : DESCRIPTIONS.linked}
      action={action}
    >
      <PagedTable
        variant="card"
        paged={paged}
        empty={
          rows.length === 0
            ? {
                icon: Package,
                message: unlinked
                  ? "Nothing imported yet"
                  : "Nothing published yet",
              }
            : { icon: Search, message: "No mods match your search" }
        }
        itemLabel="mod"
        columns={columns}
        rowKey={(row) => row.id}
      />
    </PackCard>
  );
}
