import { Eye, Clock, BarChart3, Settings, type LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ServerTabType =
  "overview" | "management" | "sessions" | "analytics";

const TABS: Array<{ id: ServerTabType; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "management", label: "Management", icon: Settings },
  { id: "sessions", label: "Sessions", icon: Clock },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export function ServerTabs() {
  return (
    <TabsList variant="underline">
      {TABS.map(({ id, label, icon: Icon }) => (
        <TabsTrigger key={id} value={id}>
          <Icon />
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
