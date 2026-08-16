import { Fragment, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  MOD_TAB_IDS,
  STAGE_CONFIG,
  TOP_TAB_IDS,
  tabGroup,
  type ModTabId,
  type TopTabId,
  type WorkshopTabId,
} from "../tabs";

const TOP_TAB_CONFIG: Record<
  TopTabId,
  {
    label: string;
    badgeTab?: WorkshopTabId;
    badgeClassName?: string;
    soonAfter?: string;
  }
> = {
  mods: { label: "Mods", badgeTab: "review" },
  dependencies: { label: "Dependencies" },
  issues: {
    label: "Issues",
    badgeTab: "issues",
    badgeClassName: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    soonAfter: "Activity",
  },
  releases: { label: "Releases" },
};

const MOD_TAB_LABELS: Record<ModTabId, string> = {
  review: STAGE_CONFIG.review.title,
  approved: STAGE_CONFIG.approved.title,
  testing: STAGE_CONFIG.testing.title,
  "next-update": STAGE_CONFIG["next-update"].title,
  "in-pack": "In Pack",
  "ruled-out": STAGE_CONFIG["ruled-out"].title,
  all: "All Mods",
};

const SCROLL_ROW_CLASSES =
  "overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function attachWheelScroll(strip: HTMLDivElement) {
  const onWheel = (event: WheelEvent) => {
    if (strip.scrollWidth <= strip.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    strip.scrollLeft +=
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 24
        : event.deltaY;
  };
  strip.addEventListener("wheel", onWheel, { passive: false });
  return () => strip.removeEventListener("wheel", onWheel);
}

function revealInStrip(
  strip: HTMLDivElement | null,
  tab: HTMLButtonElement | null,
) {
  if (!strip || !tab) return;
  const stripBox = strip.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  if (tabBox.left < stripBox.left) {
    strip.scrollLeft -= stripBox.left - tabBox.left;
  } else if (tabBox.right > stripBox.right) {
    strip.scrollLeft += tabBox.right - stripBox.right;
  }
}

export function WorkshopTabs({
  activeTab,
  onTabChange,
  onGroupChange,
  counts,
}: {
  activeTab: WorkshopTabId;
  onTabChange: (tab: WorkshopTabId) => void;
  onGroupChange: (group: TopTabId) => void;
  counts: Partial<Record<WorkshopTabId, number>>;
}) {
  const group = tabGroup(activeTab);
  const activeTopRef = useRef<HTMLButtonElement>(null);
  const activeModRef = useRef<HTMLButtonElement>(null);
  const topStripRef = useRef<HTMLDivElement | null>(null);
  const modStripRef = useRef<HTMLDivElement | null>(null);

  const countsKey = [...MOD_TAB_IDS, "issues" as const]
    .map((id) => counts[id] ?? "")
    .join();
  useEffect(() => {
    revealInStrip(topStripRef.current, activeTopRef.current);
    revealInStrip(modStripRef.current, activeModRef.current);
  }, [activeTab, countsKey]);

  const setTopStrip = useCallback((strip: HTMLDivElement | null) => {
    topStripRef.current = strip;
    return strip ? attachWheelScroll(strip) : undefined;
  }, []);

  const setModStrip = useCallback((strip: HTMLDivElement | null) => {
    modStripRef.current = strip;
    return strip ? attachWheelScroll(strip) : undefined;
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={setTopStrip}
        className={cn("border-b border-border", SCROLL_ROW_CLASSES)}
      >
        <div className="flex gap-1">
          {TOP_TAB_IDS.map((topId) => {
            const tab = TOP_TAB_CONFIG[topId];
            const isActive = group === topId;
            const count = tab.badgeTab ? counts[tab.badgeTab] : undefined;
            return (
              <Fragment key={topId}>
                <button
                  ref={isActive ? activeTopRef : undefined}
                  type="button"
                  onClick={() => onGroupChange(topId)}
                  className={cn(
                    "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80",
                  )}
                >
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", tab.badgeClassName)}
                    >
                      {count.toLocaleString()}
                    </Badge>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                  )}
                </button>
                {tab.soonAfter && (
                  <span className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground/50">
                    {tab.soonAfter}
                    <Badge
                      variant="outline"
                      className="text-xs text-muted-foreground/70"
                    >
                      Soon
                    </Badge>
                  </span>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {group === "mods" && (
        <div ref={setModStrip} className={SCROLL_ROW_CLASSES}>
          <div className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1">
            {MOD_TAB_IDS.map((id) => {
              const count = counts[id];
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  ref={isActive ? activeModRef : undefined}
                  type="button"
                  onClick={() => onTabChange(id)}
                  className={cn(
                    "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium text-foreground/80 transition-[color,box-shadow]",
                    isActive && "bg-background text-foreground shadow-sm",
                  )}
                >
                  {MOD_TAB_LABELS[id]}
                  {count !== undefined && (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-foreground/10"
                    >
                      {count.toLocaleString()}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
