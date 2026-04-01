import {
  Eye,
  Clock,
  BarChart3,
  Ticket,
  Shield,
  Ban,
  ArrowLeftRight,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabType =
  | "overview"
  | "sessions"
  | "stats"
  | "tickets"
  | "strikes"
  | "bans"
  | "transactions"
  | "audit";

interface PlayerTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: Array<{
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "sessions", label: "Sessions", icon: Clock },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "strikes", label: "Strikes", icon: Shield },
  { id: "bans", label: "Bans", icon: Ban },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "audit", label: "Audit Log", icon: FileText },
];

export function PlayerTabs({ activeTab, onTabChange }: PlayerTabsProps) {
  return (
    <div className="mx-4 overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
