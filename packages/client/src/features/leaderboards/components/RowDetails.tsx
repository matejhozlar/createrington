import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeldRecords } from "./HeldRecords";
import { PlayerActivity } from "./PlayerActivity";
import type { Stat } from "./StatPicker";

export type DetailTab = "records" | "activity";

const TABS: { value: DetailTab; label: string }[] = [
  { value: "records", label: "Records held" },
  { value: "activity", label: "Activity" },
];

function isDetailTab(value: string): value is DetailTab {
  return TABS.some((tab) => tab.value === value);
}

export function RowDetails({
  minecraftUuid,
  showRecords,
  tab,
  onTabChange,
  onPick,
}: {
  minecraftUuid: string;
  showRecords: boolean;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onPick: (stat: Stat) => void;
}) {
  if (!showRecords) return <PlayerActivity minecraftUuid={minecraftUuid} />;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => isDetailTab(value) && onTabChange(value)}
      className="gap-3"
    >
      <TabsList>
        {TABS.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="data-[state=active]:text-(--role)"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="records">
        <HeldRecords minecraftUuid={minecraftUuid} onPick={onPick} />
      </TabsContent>
      <TabsContent value="activity">
        <PlayerActivity minecraftUuid={minecraftUuid} />
      </TabsContent>
    </Tabs>
  );
}
