import { cn } from "@/lib/utils";

type TabType =
  | "overview"
  | "sessions"
  | "tickets"
  | "strikes"
  | "bans"
  | "audit";

interface PlayerTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function PlayerTabs({ activeTab, onTabChange }: PlayerTabsProps) {
  const tabs: Array<{ id: TabType; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "sessions", label: "Sessions" },
    { id: "tickets", label: "Tickets" },
    { id: "strikes", label: "Strikes" },
    { id: "bans", label: "Bans" },
    { id: "audit", label: "Audit Log" },
  ];

  return (
    <div className="mx-4 flex gap-2 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "cursor-pointer px-4 py-2 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
