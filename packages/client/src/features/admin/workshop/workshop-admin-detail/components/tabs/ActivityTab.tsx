import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  ArrowRight,
  Ban,
  Check,
  Eye,
  FlaskConical,
  History,
  Lightbulb,
  PackageCheck,
  PackageMinus,
  RefreshCw,
  RotateCcw,
  Search,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { formatRelativeDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Paginator } from "@/components/paginator";
import { PlayerLabel } from "@/components/player-label";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { CardEmpty, CardError } from "@/features/admin/components/CardState";
import {
  MOD_STATUS_STYLES,
  REJECT_REASON_LABELS,
} from "@/features/workshop/format";
import {
  WORKSHOP_MOD_EVENT_TYPES,
  WORKSHOP_MOD_EVENT_TYPE_LABELS,
} from "@createrington/shared/workshop";
import type {
  WorkshopModEventType,
  WorkshopModStatus,
} from "@createrington/shared/db";
import { ModCell, ModCellSkeleton } from "../ModCell";
import type { WorkshopEvent } from "../../types";

const EVENTS_PER_PAGE = 25;

const EVENT_STYLES: Record<
  WorkshopModEventType,
  { icon: LucideIcon; className: string }
> = {
  suggested: {
    icon: Lightbulb,
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  withdrawn: {
    icon: Undo2,
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  },
  approved: {
    icon: Check,
    className: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  },
  testing_started: {
    icon: FlaskConical,
    className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  sent_back: {
    icon: RotateCcw,
    className: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  },
  rejected: {
    icon: Ban,
    className: "border-red-500/20 bg-red-500/10 text-red-400",
  },
  shipped: {
    icon: PackageCheck,
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  dropped: {
    icon: PackageMinus,
    className: "border-rose-500/20 bg-rose-500/10 text-rose-400",
  },
};

const FULL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const PACK_SYNC_TITLE =
  "Recorded by the pack sync while following the published manifest";

type EventTypeFilter = WorkshopModEventType | "all";

function statusLabel(status: WorkshopModStatus | null): string | null {
  return status ? MOD_STATUS_STYLES[status].tableLabel : null;
}

function eventContext(event: WorkshopEvent): string | null {
  switch (event.eventType) {
    case "suggested":
      return event.note;
    case "rejected":
      return (
        [
          event.rejectReason ? REJECT_REASON_LABELS[event.rejectReason] : null,
          event.note,
        ]
          .filter(Boolean)
          .join(": ") || null
      );
    case "shipped":
      return event.releaseVersion
        ? `Release ${event.releaseVersion}`
        : "Published pack";
    case "dropped":
      return event.releaseVersion
        ? `Missing from ${event.releaseVersion}`
        : "Missing from the published pack";
    default:
      return null;
  }
}

function EventBadge({ type }: { type: WorkshopModEventType }) {
  const { icon: Icon, className } = EVENT_STYLES[type];
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
      <Icon className="size-3" />
      {WORKSHOP_MOD_EVENT_TYPE_LABELS[type]}
    </Badge>
  );
}

function Transition({ from, to }: { from: string | null; to: string | null }) {
  if (!from || !to) return <span>{to ?? from}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-muted-foreground">{from}</span>
      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{to}</span>
    </span>
  );
}

function eventHeadline(event: WorkshopEvent): React.ReactNode {
  const from = statusLabel(event.fromStatus);
  const to = statusLabel(event.toStatus);
  switch (event.eventType) {
    case "suggested":
      return event.toStatus === "approved"
        ? "Added as approved"
        : "Entered review";
    case "withdrawn":
      return "Suggestion removed";
    case "rejected":
      return event.fromStatus === "rejected" ? (
        "Reason updated"
      ) : (
        <Transition from={from} to={to} />
      );
    default:
      return <Transition from={from} to={to} />;
  }
}

function DetailsCell({ event }: { event: WorkshopEvent }) {
  const context = eventContext(event);
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="min-w-0 truncate text-sm">{eventHeadline(event)}</div>
      {context && (
        <CellText value={context} className="text-xs text-muted-foreground" />
      )}
    </div>
  );
}

function ActorCell({ event }: { event: WorkshopEvent }) {
  if (event.actor) {
    return (
      <PlayerLabel
        uuid={event.actor.minecraftUuid}
        name={event.actor.minecraftUsername}
        size={20}
      />
    );
  }
  if (event.actorDiscordId) {
    return (
      <span
        className="text-sm italic text-muted-foreground"
        title={`Discord ID ${event.actorDiscordId}`}
      >
        Former player
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
      title={PACK_SYNC_TITLE}
    >
      <RefreshCw className="size-3.5 shrink-0" />
      Pack sync
    </span>
  );
}

function ActorCellSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-5 shrink-0 rounded-xs" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

function WhenCell({ value }: { value: string | Date }) {
  const date = value instanceof Date ? value : new Date(value);
  return (
    <CellText
      value={date.toLocaleDateString("en-US", FULL_DATE_FORMAT)}
      display={formatRelativeDate(date)}
      className="text-sm text-muted-foreground"
    />
  );
}

export function ActivityTab({
  workshopId,
  search,
  onSearchChange,
  page,
  onPageChange,
  onView,
}: {
  workshopId: number;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  onView: (workshopModId: number) => void;
}) {
  const [eventType, setEventType] = useState<EventTypeFilter>("all");
  const debouncedSearch = useDebouncedValue(search.trim());

  const eventsQuery = trpc.admin.workshops.listEvents.useQuery(
    {
      workshopId,
      page,
      limit: EVENTS_PER_PAGE,
      search: debouncedSearch || undefined,
      eventType: eventType === "all" ? undefined : eventType,
    },
    { placeholderData: keepPreviousData, staleTime: 0 },
  );

  const events = eventsQuery.data?.events ?? [];
  const total = eventsQuery.data?.pagination.total ?? 0;
  const totalPages = eventsQuery.data?.pagination.totalPages ?? 0;
  const loading = eventsQuery.isLoading || eventsQuery.isPlaceholderData;
  const filtering = debouncedSearch !== "" || eventType !== "all";
  const error = eventsQuery.error?.message ?? null;

  const columns: DataTableColumn<WorkshopEvent>[] = [
    {
      key: "event",
      header: "Event",
      width: 150,
      skeleton: () => <BadgeCellSkeleton className="w-24" />,
      render: (event) => <EventBadge type={event.eventType} />,
    },
    {
      key: "mod",
      header: "Mod",
      minWidth: 200,
      skeleton: () => <ModCellSkeleton />,
      render: (event) => (
        <ModCell
          name={event.project.name ?? `Project #${event.curseforgeProjectId}`}
          slug={event.project.slug}
          thumbnailUrl={event.project.thumbnailUrl}
          classId={event.project.classId ?? undefined}
        />
      ),
    },
    {
      key: "details",
      header: "Details",
      minWidth: 220,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (event) => <DetailsCell event={event} />,
    },
    {
      key: "actor",
      header: "By",
      minWidth: 150,
      skeleton: () => <ActorCellSkeleton />,
      render: (event) => <ActorCell event={event} />,
    },
    {
      key: "when",
      header: "When",
      width: 120,
      render: (event) => <WhenCell value={event.createdAt} />,
    },
  ];

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search by mod or player..."
        activeCount={(search ? 1 : 0) + (eventType !== "all" ? 1 : 0)}
      >
        <Select
          value={eventType}
          onValueChange={(value) => {
            setEventType(value as EventTypeFilter);
            onPageChange(0);
          }}
        >
          <SelectTrigger className="min-w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {WORKSHOP_MOD_EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {WORKSHOP_MOD_EVENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Card className="gap-0">
        <CardHeader className="gap-0 border-b">
          <CardTitle>Activity ({total.toLocaleString()})</CardTitle>
        </CardHeader>

        {error ? (
          <CardError message={error} onRetry={() => eventsQuery.refetch()} />
        ) : !loading && total === 0 ? (
          filtering ? (
            <CardEmpty
              icon={Search}
              message="No activity matches your filters"
            />
          ) : (
            <CardEmpty
              icon={History}
              message="Nothing has happened in this workshop yet"
            />
          )
        ) : (
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              rows={events}
              loading={loading}
              loadingRows={loadingRowCount(page, EVENTS_PER_PAGE, total)}
              rowKey={(event) => event.id}
              onRowClick={(event) => {
                if (event.modExists) onView(event.workshopModId);
              }}
              rowClassName={(event) =>
                event.modExists ? undefined : "cursor-default"
              }
              actions={(event) =>
                event.modExists
                  ? [
                      {
                        label: "View mod",
                        icon: Eye,
                        onClick: () => onView(event.workshopModId),
                      },
                    ]
                  : []
              }
              actionSlots={1}
            />
            <Paginator
              page={page}
              limit={EVENTS_PER_PAGE}
              total={total}
              totalPages={totalPages}
              onPageChange={onPageChange}
              itemLabel="event"
              className="px-4 pt-4"
            />
          </CardContent>
        )}
      </Card>
    </>
  );
}
