import { useMemo } from "react";
import { Heart, Search } from "lucide-react";
import { CellDate, CellText } from "@/components/cell-text";
import {
  AvatarCellSkeleton,
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { TableCard } from "@/components/paged-table";
import { useClientPagination } from "@/hooks/use-client-pagination";
import type { ModEnvironment } from "@createrington/shared/db";
import { PlayerLabel } from "@/components/player-label";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { REJECT_REASON_LABELS } from "@/features/workshop/format";
import { modReviewActions, type ModReviewHandlers } from "../../actions";
import { STAGE_CONFIG, type StageColumn, type StageId } from "../../tabs";
import type { AdminWorkshopMod } from "../../types";
import {
  EnvironmentCell,
  type EnvironmentDisplay,
} from "@/features/workshop/components/EnvironmentCell";
import { DependencyCell } from "../DependencyCell";
import { ModCell, ModCellSkeleton } from "../ModCell";

const MODS_PER_PAGE = 10;

const OPTIONAL_COLUMNS: Record<
  StageColumn,
  DataTableColumn<AdminWorkshopMod>
> = {
  note: {
    key: "note",
    header: "Note",
    minWidth: 140,
    render: (mod) =>
      mod.note && (
        <CellText value={mod.note} className="text-sm text-muted-foreground" />
      ),
  },
  upvotes: {
    key: "upvotes",
    header: <Heart className="mx-auto size-3.5" />,
    width: 56,
    align: "center",
    cellClassName: "text-sm",
    render: (mod) => mod.upvoteCount,
  },
  dependencies: {
    key: "dependencies",
    header: "Pulls In",
    width: 90,
    align: "center",
    render: (mod) =>
      mod.dependencies.length > 0 && <DependencyCell mod={mod} />,
  },
  file: {
    key: "file",
    header: "File",
    minWidth: 160,
    render: (mod) =>
      mod.fileName && (
        <CellText
          value={mod.fileName}
          className="text-sm text-muted-foreground"
        />
      ),
  },
  reason: {
    key: "reason",
    header: "Reason",
    minWidth: 160,
    render: (mod) =>
      mod.rejectReason && (
        <>
          <CellText
            value={REJECT_REASON_LABELS[mod.rejectReason]}
            className="text-sm"
          />
          {mod.rejectNote && (
            <CellText
              value={mod.rejectNote}
              className="text-xs text-muted-foreground"
            />
          )}
        </>
      ),
  },
};

export function StageTab({
  stage,
  mods,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  busyModId,
  onView,
  envDisplay,
  onSetEnvironment,
  onReview,
  onReject,
}: {
  stage: StageId;
  mods: AdminWorkshopMod[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
  envDisplay: EnvironmentDisplay;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
} & ModReviewHandlers) {
  const config = STAGE_CONFIG[stage];
  const query = search.trim().toLowerCase();

  const environmentColumn: DataTableColumn<AdminWorkshopMod> = {
    key: "environment",
    header: "Environment",
    width: 140,
    skeleton: () => <BadgeCellSkeleton />,
    render: (mod) => (
      <EnvironmentCell
        projectId={mod.project.id}
        environment={mod.project.environment}
        source={mod.project.environmentSource}
        display={envDisplay}
        onSetEnvironment={onSetEnvironment}
      />
    ),
  };

  const filtered = useMemo(() => {
    if (!query) return mods;
    return mods.filter((mod) =>
      [mod.project.name, mod.project.slug, mod.submitterName].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [mods, query]);

  const paged = useClientPagination(filtered, {
    perPage: MODS_PER_PAGE,
    resetKey: [query, stage],
    loading: isLoading,
    error,
    retry: onRetry,
  });

  const columns: DataTableColumn<AdminWorkshopMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
      skeleton: () => <ModCellSkeleton />,
      render: (mod) => (
        <ModCell
          name={mod.project.name}
          slug={mod.project.slug}
          thumbnailUrl={mod.project.thumbnailUrl}
        />
      ),
    },
    {
      key: "submitter",
      header: "Submitted by",
      minWidth: 150,
      skeleton: () => <AvatarCellSkeleton />,
      render: (mod) => (
        <PlayerLabel
          name={mod.submitterName ?? mod.submittedBy}
          playerId={mod.submittedBy}
          size={20}
        />
      ),
    },
    ...config.columns.map((key) => OPTIONAL_COLUMNS[key]),
    ...(config.showEnvironment ? [environmentColumn] : []),
    {
      key: "date",
      header: config.dateHeader,
      width: 130,
      render: (mod) => <CellDate value={mod[config.dateField]} />,
    },
  ];

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search by mod or player..."
        activeCount={query ? 1 : 0}
      />

      <TableCard
        title={config.title}
        count={
          query
            ? `${filtered.length.toLocaleString()} of ${mods.length.toLocaleString()}`
            : mods.length.toLocaleString()
        }
        paged={paged}
        empty={
          mods.length === 0
            ? { icon: config.emptyIcon, message: config.emptyMessage }
            : { icon: Search, message: "No mods match your search" }
        }
        itemLabel="mod"
        columns={columns}
        rowKey={(mod) => mod.id}
        onRowClick={(mod) => onView(mod.id)}
        actions={(mod) =>
          modReviewActions(mod, { onReview, onReject }, envDisplay)
        }
        isRowBusy={(mod) => busyModId === mod.id}
      />
    </>
  );
}
