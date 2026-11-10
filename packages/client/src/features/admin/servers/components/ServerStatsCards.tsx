import { Server, Users, Clock, Activity, type LucideIcon } from "lucide-react";
import { StatCard, type StatTone } from "@/components/stat-card";

interface ServerStatsCardsProps {
  isOnline: boolean;
  playerCount: number;
  maxPlayers: number;
  totalHours: number;
  avgSessionSeconds: number;
}

type Stat = {
  label: string;
  icon: LucideIcon;
  tone: StatTone;
  value: React.ReactNode;
};

export function ServerStatsCards({
  isOnline,
  playerCount,
  maxPlayers,
  totalHours,
  avgSessionSeconds,
}: ServerStatsCardsProps) {
  const stats: Stat[] = [
    {
      label: "Status",
      icon: Server,
      tone: isOnline ? "success" : "muted",
      value: (
        <span className={isOnline ? "text-success" : "text-muted-foreground"}>
          {isOnline ? "Online" : "Offline"}
        </span>
      ),
    },
    {
      label: "Online Players",
      icon: Users,
      tone: "chart-2",
      value: (
        <>
          {playerCount}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            / {maxPlayers}
          </span>
        </>
      ),
    },
    {
      label: "Total Playtime",
      icon: Clock,
      tone: "chart-3",
      value: `${totalHours.toLocaleString()}h`,
    },
    {
      label: "Avg Session",
      icon: Activity,
      tone: "chart-4",
      value: `${Math.round(avgSessionSeconds / 60)}m`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, ...stat }) => (
        <StatCard key={label} label={label} {...stat} />
      ))}
    </div>
  );
}
