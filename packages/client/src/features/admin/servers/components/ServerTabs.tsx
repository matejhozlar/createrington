import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ServerTabType = "overview" | "sessions" | "analytics";

interface ServerTabsProps {
  activeTab: ServerTabType;
  onTabChange: (tab: ServerTabType) => void;
}

const TABS: Array<{ id: ServerTabType; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "sessions", label: "Sessions" },
  { id: "analytics", label: "Analytics" },
];

export function ServerTabs({ activeTab, onTabChange }: ServerTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as ServerTabType)}
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
