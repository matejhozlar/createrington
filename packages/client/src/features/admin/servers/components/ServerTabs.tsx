import { Eye, Clock, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type ServerTabType =
  "overview" | "management" | "sessions" | "analytics";

interface ServerTabsProps {
  activeTab: ServerTabType;
  onTabChange: (tab: ServerTabType) => void;
}

const TABS: Array<{
  id: ServerTabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "management", label: "Management", icon: Settings },
  { id: "sessions", label: "Sessions", icon: Clock },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export function ServerTabs({ activeTab, onTabChange }: ServerTabsProps) {
  return (
    <div className="overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
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
