import { CalendarDays, Gift, Users, Vote, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import type { RouterOutput } from "@/lib/trpc";

type Stats = RouterOutput["admin"]["votes"]["stats"];

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const CARDS: {
  key: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: (stats: Stats) => number;
  detail: (stats: Stats) => string;
}[] = [
  {
    key: "total",
    label: "Total votes",
    icon: Vote,
    iconBg: "bg-sidebar-primary/10",
    iconColor: "text-sidebar-primary",
    value: (stats) => stats.total,
    detail: (stats) =>
      stats.firstVotedAt
        ? `Since ${new Date(stats.firstVotedAt).toLocaleDateString()}`
        : "No vote yet",
  },
  {
    key: "recent",
    label: "Last 30 days",
    icon: CalendarDays,
    iconBg: "bg-chart-2/10",
    iconColor: "text-chart-2",
    value: (stats) => stats.last30Days,
    detail: (stats) => `${stats.last24Hours} in the last 24 hours`,
  },
  {
    key: "voters",
    label: "Voters",
    icon: Users,
    iconBg: "bg-chart-3/10",
    iconColor: "text-chart-3",
    value: (stats) => stats.voters,
    detail: (stats) =>
      stats.unlinked === 0
        ? "No vote is waiting for a registration"
        : `${plural(stats.unlinked, "vote")} waiting for the name to register`,
  },
  {
    key: "pending",
    label: "Pending rewards",
    icon: Gift,
    iconBg: "bg-chart-4/10",
    iconColor: "text-chart-4",
    value: (stats) => stats.pending,
    detail: (stats) =>
      stats.pendingPlayers === 0
        ? "Every voter is paid"
        : `${plural(stats.pendingPlayers, "player")} waiting for their next join`,
  },
];

export function VoteStatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(
        ({ key, label, icon: Icon, iconBg, iconColor, value, detail }) => (
          <Card key={key}>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {value(stats).toLocaleString()}
                </CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {detail(stats)}
                </p>
              </div>
              <div
                className={`flex size-12 items-center justify-center rounded-full ${iconBg}`}
              >
                <Icon className={`size-6 ${iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
