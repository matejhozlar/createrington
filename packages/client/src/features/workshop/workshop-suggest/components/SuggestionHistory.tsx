import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE } from "../../constants";
import { useViewMode } from "../../hooks/use-view-mode";
import { ProjectThumb } from "../../components/ProjectThumb";
import { QueryErrorState } from "../../components/QueryErrorState";
import { SocialLinks } from "../../components/SocialLinks";
import { ViewToggle } from "../../components/ViewToggle";
import {
  MOD_STATUS_STYLES,
  REJECT_REASON_LABELS,
  formatDate,
} from "../../format";

type HistoryItem =
  RouterOutput["user"]["workshops"]["mySuggestionHistory"][number];

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortMode = "new" | "old" | "updated";

function secondaryLine(mod: HistoryItem): string {
  if (mod.status === "rejected") {
    const label = mod.rejectReason
      ? REJECT_REASON_LABELS[mod.rejectReason]
      : "Ruled out";
    return mod.rejectNote ? `${label} — ${mod.rejectNote}` : label;
  }
  return mod.note ? `“${mod.note}”` : "";
}

function StatusBadge({ mod }: { mod: HistoryItem }) {
  const style =
    mod.status === "approved" && mod.live
      ? MOD_STATUS_STYLES.live
      : MOD_STATUS_STYLES[mod.status];
  const label =
    mod.status === "rejected" && mod.rejectReason
      ? REJECT_REASON_LABELS[mod.rejectReason]
      : style.label;
  return (
    <Badge
      variant="outline"
      className={style.className}
      title={
        mod.live && mod.liveInVersion
          ? `Live since ${mod.liveInVersion}`
          : undefined
      }
    >
      {label}
    </Badge>
  );
}

export function SuggestionHistory() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [view, changeView] = useViewMode("workshop-suggest-history-view");

  const historyQuery = trpc.user.workshops.mySuggestionHistory.useQuery();

  const history = historyQuery.data ?? [];
  let visible =
    status === "all" ? history : history.filter((m) => m.status === status);
  const sortKey = (mod: HistoryItem) =>
    new Date(sortMode === "updated" ? mod.updatedAt : mod.createdAt).getTime();
  visible = [...visible].sort((a, b) =>
    sortMode === "old"
      ? sortKey(a) - sortKey(b) || a.id - b.id
      : sortKey(b) - sortKey(a) || b.id - a.id,
  );
  const remaining = visible.length - shownCount;
  const shown = visible.slice(0, shownCount);

  const dateLine = (mod: HistoryItem) =>
    sortMode === "updated"
      ? `updated ${formatDate(mod.updatedAt)}`
      : formatDate(mod.createdAt);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[22px] leading-7 font-semibold">My suggestions</h2>
        <span className="flex-1" />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as StatusFilter);
            setShownCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">In review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Ruled out</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortMode}
          onValueChange={(value) => {
            setSortMode(value as SortMode);
            setShownCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Newest first</SelectItem>
            <SelectItem value="old">Oldest first</SelectItem>
            <SelectItem value="updated">Last updated</SelectItem>
          </SelectContent>
        </Select>
        <ViewToggle view={view} onChange={changeView} />
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Everything you've suggested across workshops, including ruled-out ones.
      </p>

      {historyQuery.isLoading ? (
        <Loading
          size="medium"
          className="py-12"
          text="Loading suggestions..."
        />
      ) : historyQuery.error ? (
        <div className="mt-4">
          <QueryErrorState
            compact
            message={historyQuery.error.message}
            onRetry={() => historyQuery.refetch()}
          />
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-muted-foreground">
          {history.length === 0
            ? "You haven't suggested anything yet."
            : "No suggestions match this filter."}
        </div>
      ) : view === "list" ? (
        <div className="mt-4 flex flex-col gap-2">
          {shown.map((mod) => {
            const secondary = secondaryLine(mod);
            return (
              <div
                key={mod.id}
                className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3"
              >
                <ProjectThumb
                  name={mod.project.name}
                  thumbnailUrl={mod.project.thumbnailUrl}
                  className="size-9 rounded-[9px] text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {mod.project.name}
                  </div>
                  {secondary && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {secondary}
                    </div>
                  )}
                </div>
                <div className="mr-1 hidden shrink-0 items-center gap-3.5 sm:flex">
                  <SocialLinks
                    discordThreadUrl={mod.discordThreadUrl}
                    websiteUrl={mod.project.websiteUrl}
                  />
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                  <span className="hidden md:inline">
                    {mod.workshopName} ·{" "}
                  </span>
                  {dateLine(mod)}
                </span>
                <span className="flex min-w-[82px] shrink-0 justify-end">
                  <StatusBadge mod={mod} />
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
          {shown.map((mod) => {
            const secondary = secondaryLine(mod);
            return (
              <div
                key={mod.id}
                className="group flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2.5">
                  <ProjectThumb
                    name={mod.project.name}
                    thumbnailUrl={mod.project.thumbnailUrl}
                    className="size-10 rounded-[9px] text-xs"
                  />
                  <span className="flex-1" />
                  <StatusBadge mod={mod} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {mod.project.name}
                  </div>
                  {secondary && (
                    <div className="mt-1 line-clamp-2 text-xs leading-[17px] text-muted-foreground">
                      {secondary}
                    </div>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-3">
                  <SocialLinks
                    discordThreadUrl={mod.discordThreadUrl}
                    websiteUrl={mod.project.websiteUrl}
                    iconClass="size-[18px]"
                  />
                  <span className="flex-1" />
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {mod.workshopName} · {dateLine(mod)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => setShownCount(shownCount + PAGE_SIZE)}
          >
            Show {Math.min(remaining, PAGE_SIZE)} more
          </Button>
        </div>
      )}
    </section>
  );
}
