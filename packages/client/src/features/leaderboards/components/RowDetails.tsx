import { Link } from "react-router";
import { Swords } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compareHref } from "../compare/headToHead";
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

function CompareLink({
  minecraftUuid,
  minecraftUsername,
}: {
  minecraftUuid: string;
  minecraftUsername: string;
}) {
  const { user } = useAuth();
  const withYou = !!user && user.minecraftUuid !== minecraftUuid;

  return (
    <Button asChild variant="outline" size="sm" className="shrink-0">
      <Link
        to={compareHref(
          minecraftUsername,
          withYou ? user.minecraftUsername : null,
        )}
      >
        <Swords aria-hidden />
        {withYou ? "Compare with you" : "Compare with…"}
      </Link>
    </Button>
  );
}

export function RowDetails({
  minecraftUuid,
  minecraftUsername,
  showRecords,
  tab,
  onTabChange,
  onPick,
}: {
  minecraftUuid: string;
  minecraftUsername: string;
  showRecords: boolean;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onPick: (stat: Stat) => void;
}) {
  if (!showRecords) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <CompareLink
            minecraftUuid={minecraftUuid}
            minecraftUsername={minecraftUsername}
          />
        </div>
        <PlayerActivity minecraftUuid={minecraftUuid} />
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => isDetailTab(value) && onTabChange(value)}
      className="gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <CompareLink
          minecraftUuid={minecraftUuid}
          minecraftUsername={minecraftUsername}
        />
      </div>
      <TabsContent value="records">
        <HeldRecords minecraftUuid={minecraftUuid} onPick={onPick} />
      </TabsContent>
      <TabsContent value="activity">
        <PlayerActivity minecraftUuid={minecraftUuid} />
      </TabsContent>
    </Tabs>
  );
}
