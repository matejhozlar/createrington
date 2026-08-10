import {
  Ban,
  Check,
  FlaskConical,
  Heart,
  Lightbulb,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";
import { Paginator } from "@/components/paginator";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { PlayerLabel } from "@/components/player-label";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import {
  DEPENDENCY_COVERAGE_STYLES,
  MOD_STATUS_STYLES,
  dependencyIsCovered,
} from "@/features/workshop/format";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";

export type AdminWorkshopMod =
  RouterOutput["admin"]["workshops"]["listMods"][number];

const REQUIRED_DEPENDENCY = 3;
const SUGGESTIONS_PER_PAGE = 10;

function DependencyCell({ mod }: { mod: AdminWorkshopMod }) {
  const required = mod.dependencies.filter(
    (dep) => dep.relationType === REQUIRED_DEPENDENCY,
  );
  const optional = mod.dependencies.filter(
    (dep) => dep.relationType !== REQUIRED_DEPENDENCY,
  );
  const uncovered = required.filter(
    (dep) => !dependencyIsCovered(dep.coverage),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          <Badge
            variant="outline"
            className={cn(
              "text-xs transition-colors hover:brightness-125",
              uncovered.length > 0
                ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
            )}
          >
            {uncovered.length > 0
              ? `+${uncovered.length}`
              : `${mod.dependencies.length}`}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        {[
          { label: "Required", deps: required },
          { label: "Optional", deps: optional },
        ]
          .filter((group) => group.deps.length > 0)
          .map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {group.label}
              </p>
              {group.deps.map((dep) => (
                <div
                  key={dep.curseforgeProjectId}
                  className="flex items-center gap-2 text-sm"
                >
                  <ProjectThumb
                    name={dep.name ?? ""}
                    thumbnailUrl={dep.thumbnailUrl}
                    className="size-6 rounded text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {dep.name ?? `Project #${dep.curseforgeProjectId}`}
                    </p>
                    {dep.requiredByCount > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Wanted by {dep.requiredByCount} mods
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-xs",
                      DEPENDENCY_COVERAGE_STYLES[dep.coverage]?.className,
                    )}
                  >
                    {DEPENDENCY_COVERAGE_STYLES[dep.coverage]?.label ??
                      dep.coverage}
                  </Badge>
                </div>
              ))}
            </div>
          ))}
      </PopoverContent>
    </Popover>
  );
}

export function SuggestionsCard({
  mods,
  total,
  filtered,
  isLoading,
  error,
  onRetry,
  page: requestedPage,
  onPageChange,
  busyModId,
  onView,
  onReview,
  onReject,
}: {
  mods: AdminWorkshopMod[];
  total: number;
  filtered: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  page: number;
  onPageChange: (page: number) => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
  onReview: (workshopModId: number, action: WorkshopModReviewAction) => void;
  onReject: (target: { workshopModId: number; name: string }) => void;
}) {
  const totalPages = Math.ceil(mods.length / SUGGESTIONS_PER_PAGE);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));
  const visible = mods.slice(
    page * SUGGESTIONS_PER_PAGE,
    (page + 1) * SUGGESTIONS_PER_PAGE,
  );

  const columns: DataTableColumn<AdminWorkshopMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
      render: (mod) => (
        <div className="flex min-w-0 items-center gap-2">
          <ProjectThumb
            name={mod.project.name}
            thumbnailUrl={mod.project.thumbnailUrl}
            className="size-8 shrink-0 rounded text-[11px]"
          />
          <div className="min-w-0">
            <CellText value={mod.project.name} className="font-medium" />
            <CellText
              value={mod.project.slug}
              className="text-xs text-muted-foreground"
            />
          </div>
        </div>
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
    {
      key: "note",
      header: "Note",
      minWidth: 140,
      render: (mod) =>
        mod.note && (
          <CellText
            value={mod.note}
            className="text-sm text-muted-foreground"
          />
        ),
    },
    {
      key: "upvotes",
      header: <Heart className="mx-auto size-3.5" />,
      width: 56,
      align: "center",
      cellClassName: "text-sm",
      render: (mod) => mod.upvoteCount,
    },
    {
      key: "dependencies",
      header: "Pulls In",
      width: 90,
      align: "center",
      render: (mod) =>
        mod.dependencies.length > 0 && <DependencyCell mod={mod} />,
    },
    {
      key: "status",
      header: "Status",
      width: 124,
      render: (mod) => {
        const status = MOD_STATUS_STYLES[mod.status];
        return status ? (
          <Badge variant="outline" className={cn("text-xs", status.className)}>
            {status.tableLabel}
          </Badge>
        ) : null;
      },
    },
    {
      key: "date",
      header: "Date",
      width: 120,
      render: (mod) => <CellDate value={mod.createdAt} />,
    },
  ];

  const modActions = (mod: AdminWorkshopMod): DataTableAction[] => {
    const actions: DataTableAction[] = [];
    if (mod.status === "pending" || mod.status === "rejected") {
      actions.push({
        label: "Approve",
        icon: Check,
        iconClassName: "text-green-500",
        onClick: () => onReview(mod.id, "approve"),
      });
    }
    if (mod.status === "approved") {
      actions.push({
        label: "Start Testing",
        icon: FlaskConical,
        iconClassName: "text-amber-400",
        onClick: () => onReview(mod.id, "start_testing"),
      });
    }
    if (mod.status === "testing") {
      actions.push({
        label: "Approve for Next Update",
        icon: Check,
        iconClassName: "text-green-500",
        onClick: () => onReview(mod.id, "approve"),
      });
    }
    if (mod.status === "testing" || mod.status === "next_update") {
      actions.push({
        label: "Send Back a Stage",
        icon: Undo2,
        onClick: () => onReview(mod.id, "send_back"),
      });
    }
    actions.push({
      label: "Reject",
      icon: Ban,
      variant: "destructive",
      onClick: () =>
        onReject({ workshopModId: mod.id, name: mod.project.name }),
    });
    return actions;
  };

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>
          Suggestions (
          {filtered
            ? `${mods.length.toLocaleString()} of ${total.toLocaleString()}`
            : total.toLocaleString()}
          )
        </CardTitle>
      </CardHeader>

      {isLoading ? (
        <CardLoading text="Loading suggestions..." />
      ) : error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : mods.length === 0 ? (
        <CardEmpty icon={Lightbulb} message="No suggestions match this view" />
      ) : (
        <CardContent className="px-0">
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(mod) => mod.id}
            onRowClick={(mod) => onView(mod.id)}
            actions={modActions}
            isRowBusy={(mod) => busyModId === mod.id}
          />

          <Paginator
            page={page}
            limit={SUGGESTIONS_PER_PAGE}
            total={mods.length}
            totalPages={totalPages}
            onPageChange={onPageChange}
            itemLabel="suggestion"
            className="px-4 pt-4"
          />
        </CardContent>
      )}
    </Card>
  );
}
