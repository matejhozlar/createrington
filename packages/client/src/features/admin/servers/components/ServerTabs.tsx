import { cn } from "@/lib/utils";

export type ServerTabType = "overview" | "sessions" | "analytics";

interface ServerTabsProps {
  activeTab: ServerTabType;
  onTabChange: (tab: ServerTabType) => void;
}

export function ServerTabs({ activeTab, onTabChange }: ServerTabsProps) {
  const tabs: Array<{ id: ServerTabType; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "sessions", label: "Sessions" },
    { id: "analytics", label: "Analytics" },
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
