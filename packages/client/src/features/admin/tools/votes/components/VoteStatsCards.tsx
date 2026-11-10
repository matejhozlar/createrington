import { CalendarDays, Gift, Users, Vote, type LucideIcon } from "lucide-react";
import { StatCard, type StatTone } from "@/components/stat-card";
import type { RouterOutput } from "@/lib/trpc";

type Stats = RouterOutput["admin"]["votes"]["stats"];

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const CARDS: {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: StatTone;
  value: (stats: Stats) => number;
  detail: (stats: Stats) => string;
}[] = [
  {
    key: "total",
    label: "Total votes",
    icon: Vote,
    tone: "primary",
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
    tone: "chart-2",
    value: (stats) => stats.last30Days,
    detail: (stats) => `${stats.last24Hours} in the last 24 hours`,
  },
  {
    key: "voters",
    label: "Voters",
    icon: Users,
    tone: "chart-3",
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
    tone: "chart-4",
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
      {CARDS.map(({ key, label, icon, tone, value, detail }) => (
        <StatCard
          key={key}
          label={label}
          value={value(stats).toLocaleString()}
          icon={icon}
          tone={tone}
          footer={detail(stats)}
        />
      ))}
    </div>
  );
}
