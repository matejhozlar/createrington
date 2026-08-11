import { useMemo } from "react";
import { Heart, Search } from "lucide-react";
import { Paginator } from "@/components/paginator";
import { CellDate, CellText } from "@/components/cell-text";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { PlayerLabel } from "@/components/player-label";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import { REJECT_REASON_LABELS } from "@/features/workshop/format";
import { modReviewActions, type ModReviewHandlers } from "../../actions";
import { STAGE_CONFIG, type StageColumn, type StageId } from "../../tabs";
import type { AdminWorkshopMod } from "../../types";
import { DependencyCell } from "../DependencyCell";
import { ModCell } from "../ModCell";

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
  page: requestedPage,
  onPageChange,
  busyModId,
  onView,
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
  page: number;
  onPageChange: (page: number) => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
} & ModReviewHandlers) {
  const config = STAGE_CONFIG[stage];
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return mods;
    return mods.filter((mod) =>
      [mod.project.name, mod.project.slug, mod.submitterName].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [mods, query]);

  const totalPages = Math.ceil(filtered.length / MODS_PER_PAGE);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));
  const visible = filtered.slice(
    page * MODS_PER_PAGE,
    (page + 1) * MODS_PER_PAGE,
  );

  const columns: DataTableColumn<AdminWorkshopMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
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
      render: (mod) => (
        <PlayerLabel
          name={mod.submitterName ?? mod.submittedBy}
          playerId={mod.submittedBy}
          size={20}
        />
      ),
    },
    ...config.columns.map((key) => OPTIONAL_COLUMNS[key]),
    {
      key: "date",
      header: config.dateHeader,
      width: 130,
      render: (mod) => <CellDate value={mod[config.dateField]} />,
    },
  ];

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>
          {config.title} (
          {query
            ? `${filtered.length.toLocaleString()} of ${mods.length.toLocaleString()}`
            : mods.length.toLocaleString()}
          )
        </CardTitle>
        <CardAction>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by mod or player..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-64 pl-9"
            />
          </div>
        </CardAction>
      </CardHeader>

      {isLoading ? (
        <CardLoading text="Loading mods..." />
      ) : error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : mods.length === 0 ? (
        <CardEmpty icon={config.emptyIcon} message={config.emptyMessage} />
      ) : filtered.length === 0 ? (
        <CardEmpty icon={Search} message="No mods match your search" />
      ) : (
        <CardContent className="px-0">
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(mod) => mod.id}
            onRowClick={(mod) => onView(mod.id)}
            actions={(mod) => modReviewActions(mod, { onReview, onReject })}
            isRowBusy={(mod) => busyModId === mod.id}
          />

          <Paginator
            page={page}
            limit={MODS_PER_PAGE}
            total={filtered.length}
            totalPages={totalPages}
            onPageChange={onPageChange}
            itemLabel="mod"
            className="px-4 pt-4"
          />
        </CardContent>
      )}
    </Card>
  );
}
