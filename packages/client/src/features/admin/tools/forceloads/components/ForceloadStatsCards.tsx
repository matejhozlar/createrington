import { Users, UsersRound, Grid3X3, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  totalPlayers: number;
  totalParties: number;
  totalChunks: number;
  activeChunks: number;
}

const STAT_CARDS = [
  {
    key: "totalPlayers" as const,
    label: "Solo Players",
    icon: Users,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "totalParties" as const,
    label: "Parties",
    icon: UsersRound,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    key: "totalChunks" as const,
    label: "Total Chunks",
    icon: Grid3X3,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
  {
    key: "activeChunks" as const,
    label: "Active Chunks",
    icon: Zap,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
];

export function ForceloadStatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {STAT_CARDS.map(({ key, label, icon: Icon, iconBg, iconColor }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-md ${iconBg}`}
            >
              <Icon className={`size-5 ${iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{stats[key]}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
