import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MOD_TAB_IDS,
  tabGroup,
  type ModTabId,
  type TopTabId,
  type WorkshopTabId,
} from "../tabs";

const TOP_TABS: ReadonlyArray<{
  id?: TopTabId;
  label: string;
  badgeTab?: WorkshopTabId;
  badgeClassName?: string;
}> = [
  { id: "mods", label: "Mods", badgeTab: "review" },
  { id: "dependencies", label: "Dependencies" },
  {
    id: "issues",
    label: "Issues",
    badgeTab: "issues",
    badgeClassName: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  { label: "Activity" },
  { id: "releases", label: "Releases" },
];

const MOD_TAB_LABELS: Record<ModTabId, string> = {
  review: "In Review",
  approved: "Approved",
  testing: "Testing",
  "next-update": "Next Update",
  "in-pack": "In Pack",
  "ruled-out": "Ruled Out",
  all: "All Mods",
};

const SCROLL_ROW_CLASSES =
  "overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

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
  const activeModRef = useRef<HTMLButtonElement>(null);

  const wheelScrollRef = useCallback((strip: HTMLDivElement | null) => {
    if (!strip) return;
    const onWheel = (event: WheelEvent) => {
      if (strip.scrollWidth <= strip.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      strip.scrollLeft += event.deltaY;
    };
    strip.addEventListener("wheel", onWheel, { passive: false });
    return () => strip.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    activeModRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wheelScrollRef}
        className={cn("border-b border-border", SCROLL_ROW_CLASSES)}
      >
        <div className="flex gap-1">
          {TOP_TABS.map((tab) => {
            const topId = tab.id;
            if (!topId) {
              return (
                <span
                  key={tab.label}
                  className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground/50"
                >
                  {tab.label}
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground/70"
                  >
                    Soon
                  </Badge>
                </span>
              );
            }
            const isActive = group === topId;
            const count = tab.badgeTab ? counts[tab.badgeTab] : undefined;
            return (
              <button
                key={topId}
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
            );
          })}
        </div>
      </div>

      {group === "mods" && (
        <div ref={wheelScrollRef} className={SCROLL_ROW_CLASSES}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as ModTabId)}
          >
            <TabsList>
              {MOD_TAB_IDS.map((id) => {
                const count = counts[id];
                return (
                  <TabsTrigger
                    key={id}
                    value={id}
                    ref={id === activeTab ? activeModRef : undefined}
                  >
                    {MOD_TAB_LABELS[id]}
                    {count !== undefined && (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground"
                      >
                        {count.toLocaleString()}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      )}
    </div>
  );
}
