import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkshopTabId } from "../tabs";

const TABS: ReadonlyArray<{
  id?: WorkshopTabId;
  label: string;
  badgeClassName?: string;
}> = [
  { id: "review", label: "In Review" },
  { id: "approved", label: "Approved" },
  { id: "testing", label: "Testing" },
  { id: "next-update", label: "Next Update" },
  { id: "in-pack", label: "In Pack" },
  { id: "ruled-out", label: "Ruled Out" },
  { id: "all", label: "All Mods" },
  { id: "dependencies", label: "Dependencies" },
  {
    id: "issues",
    label: "Issues",
    badgeClassName: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  { label: "Activity" },
  { id: "releases", label: "Releases" },
];

export function WorkshopTabs({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: WorkshopTabId;
  onTabChange: (tab: WorkshopTabId) => void;
  counts: Partial<Record<WorkshopTabId, number>>;
}) {
  return (
    <div className="overflow-x-auto overflow-y-hidden border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const tabId = tab.id;
          if (!tabId) {
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
          const isActive = activeTab === tabId;
          const count = counts[tabId];
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => onTabChange(tabId)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              {tab.label}
              {count !== undefined && (
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
  );
}
