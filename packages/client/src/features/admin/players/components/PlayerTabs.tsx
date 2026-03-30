import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabType =
  | "overview"
  | "sessions"
  | "tickets"
  | "strikes"
  | "bans"
  | "transactions"
  | "audit";

interface PlayerTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: Array<{ id: TabType; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "sessions", label: "Sessions" },
  { id: "tickets", label: "Tickets" },
  { id: "strikes", label: "Strikes" },
  { id: "bans", label: "Bans" },
  { id: "transactions", label: "Transactions" },
  { id: "audit", label: "Audit Log" },
];

export function PlayerTabs({ activeTab, onTabChange }: PlayerTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as TabType)}
      className="mx-4"
    >
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
