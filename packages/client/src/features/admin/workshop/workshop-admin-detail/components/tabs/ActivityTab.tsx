import { useState } from "react";
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
import { trpc } from "@/lib/trpc";
import { formatFullDateSafe } from "@/features/admin/format";
import { formatRelativeDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { TableCard } from "@/components/paged-table";
import { PlayerLabel } from "@/components/player-label";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { MOD_STATUS_STYLES } from "@/features/workshop/format";
import {
  WORKSHOP_MOD_EVENT_TYPES,
  WORKSHOP_MOD_EVENT_TYPE_LABELS,
  WORKSHOP_MOD_REJECT_REASON_LABELS,
} from "@createrington/shared/workshop";
import type {
  WorkshopModEventType,
  WorkshopModStatus,
} from "@createrington/shared/db";
import {
  ModCell,
  ModCellSkeleton,
} from "@/features/admin/workshop/workshop-admin-detail/components/ModCell";
import type { WorkshopEvent } from "@/features/admin/workshop/workshop-admin-detail/types";

const EVENTS_PER_PAGE = 25;

const EVENT_STYLES: Record<
  WorkshopModEventType,
  { icon: LucideIcon; tone: BadgeTone }
> = {
  suggested: {
    icon: Lightbulb,
    tone: "primary",
  },
  withdrawn: {
    icon: Undo2,
    tone: "neutral",
  },
  approved: {
    icon: Check,
    tone: "info",
  },
  testing_started: {
    icon: FlaskConical,
    tone: "warning",
  },
  sent_back: {
    icon: RotateCcw,
    tone: "orange",
  },
  rejected: {
    icon: Ban,
    tone: "danger",
  },
  shipped: {
    icon: PackageCheck,
    tone: "success",
  },
  dropped: {
    icon: PackageMinus,
    tone: "rose",
  },
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
          event.rejectReason
            ? WORKSHOP_MOD_REJECT_REASON_LABELS[event.rejectReason]
            : null,
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
  const { icon: Icon, tone } = EVENT_STYLES[type];
  return (
    <Badge tone={tone}>
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
  if (!event.actorDiscordId) {
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
  return (
    <PlayerLabel
      uuid={event.actor?.minecraftUuid}
      name={event.actor?.minecraftUsername ?? event.actorDiscordId}
      playerId={event.actorDiscordId}
      size={20}
    />
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

export function ActivityTab({
  workshopId,
  search,
  onSearchChange,
  onView,
}: {
  workshopId: number;
  search: string;
  onSearchChange: (value: string) => void;
  onView: (workshopModId: number) => void;
}) {
  const [eventType, setEventType] = useState<EventTypeFilter>("all");
  const debouncedSearch = useDebouncedValue(search.trim());

  const events = usePagedQuery(
    {
      workshopId,
      search: debouncedSearch || undefined,
      eventType: eventType === "all" ? undefined : eventType,
    },
    (input) =>
      trpc.admin.workshops.listEvents.queryOptions(input, { staleTime: 0 }),
    EVENTS_PER_PAGE,
  );
  const filtering = debouncedSearch !== "" || eventType !== "all";

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
      render: (event) => (
        <CellText
          value={formatFullDateSafe(event.createdAt)}
          display={formatRelativeDate(event.createdAt)}
          className="text-sm text-muted-foreground"
        />
      ),
    },
  ];

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search by mod or player..."
        activeCount={(search.trim() ? 1 : 0) + (eventType !== "all" ? 1 : 0)}
      >
        <Select
          value={eventType}
          onValueChange={(value) => setEventType(value as EventTypeFilter)}
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

      <TableCard
        title="Activity"
        paged={events}
        empty={
          filtering
            ? { icon: Search, message: "No activity matches your filters" }
            : {
                icon: History,
                message: "Nothing has happened in this workshop yet",
              }
        }
        itemLabel="event"
        columns={columns}
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
    </>
  );
}
