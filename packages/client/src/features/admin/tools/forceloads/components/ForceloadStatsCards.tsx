import type { LucideIcon } from "lucide-react";
import { Activity, Grid3X3, User, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Stats {
  totalPlayers: number;
  totalParties: number;
  totalChunks: number;
  activeChunks: number;
}

const STAT_CARDS: {
  key: keyof Stats;
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    key: "totalPlayers",
    label: "Solo Players",
    description: "Players with active forceloads",
    icon: User,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "totalParties",
    label: "Parties",
    description: "Groups with active forceloads",
    icon: Users,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    key: "totalChunks",
    label: "Total Chunks",
    description: "All forceloaded chunks",
    icon: Grid3X3,
    iconBg: "bg-muted-foreground/10",
    iconColor: "text-muted-foreground",
  },
  {
    key: "activeChunks",
    label: "Active Chunks",
    description: "Currently loaded in-world",
    icon: Activity,
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
];

export function ForceloadStatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {STAT_CARDS.map(
        ({ key, label, description, icon: Icon, iconBg, iconColor }) => (
          <Card key={key}>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{stats[key]}</CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-full",
                  iconBg,
                )}
              >
                <Icon className={cn("size-6", iconColor)} />
              </div>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
