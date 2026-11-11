import { useCallback, useLayoutEffect, useRef } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    badgeTone?: BadgeTone;
  }
> = {
  mods: { label: "Mods", badgeTab: "review" },
  dependencies: { label: "Dependencies" },
  issues: {
    label: "Issues",
    badgeTab: "issues",
    badgeTone: "warning",
  },
  activity: { label: "Activity" },
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

type TabCounts = Partial<Record<WorkshopTabId, number>>;

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
  const scrollportLeft = strip.getBoundingClientRect().left + strip.clientLeft;
  const scrollportRight = scrollportLeft + strip.clientWidth;
  const tabBox = tab.getBoundingClientRect();
  if (tabBox.left < scrollportLeft) {
    strip.scrollLeft -= scrollportLeft - tabBox.left;
  } else if (tabBox.right > scrollportRight) {
    strip.scrollLeft += tabBox.right - scrollportRight;
  }
}

function useScrollStrip(activeTab: WorkshopTabId, counts: TabCounts) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const setStrip = useCallback((strip: HTMLDivElement | null) => {
    stripRef.current = strip;
    if (!strip) return;
    const detach = attachWheelScroll(strip);
    return () => {
      detach();
      stripRef.current = null;
    };
  }, []);

  const countsKey = [...MOD_TAB_IDS, "issues" as const]
    .map((id) => counts[id] ?? "")
    .join();
  useLayoutEffect(() => {
    revealInStrip(stripRef.current, activeRef.current);
  }, [activeTab, countsKey]);

  return { setStrip, activeRef };
}

export function WorkshopGroupTabs({
  activeTab,
  counts,
}: {
  activeTab: WorkshopTabId;
  counts: TabCounts;
}) {
  const group = tabGroup(activeTab);
  const { setStrip, activeRef } = useScrollStrip(activeTab, counts);

  return (
    <TabsList ref={setStrip} variant="underline">
      {TOP_TAB_IDS.map((topId) => {
        const tab = TOP_TAB_CONFIG[topId];
        const count = tab.badgeTab ? counts[tab.badgeTab] : undefined;
        return (
          <TabsTrigger
            key={topId}
            ref={group === topId ? activeRef : undefined}
            value={topId}
          >
            {tab.label}
            {count !== undefined && count > 0 && (
              <Badge variant="outline" tone={tab.badgeTone} className="text-xs">
                {count.toLocaleString()}
              </Badge>
            )}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

export function WorkshopModTabs({
  activeTab,
  counts,
}: {
  activeTab: ModTabId;
  counts: TabCounts;
}) {
  const { setStrip, activeRef } = useScrollStrip(activeTab, counts);

  return (
    <div
      ref={setStrip}
      className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <TabsList className="text-foreground/80">
        {MOD_TAB_IDS.map((id) => {
          const count = counts[id];
          return (
            <TabsTrigger
              key={id}
              ref={activeTab === id ? activeRef : undefined}
              value={id}
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
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
