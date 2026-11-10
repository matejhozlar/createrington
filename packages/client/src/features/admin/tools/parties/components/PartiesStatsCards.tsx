import { Grid3X3, Tag, UserRound, Users, type LucideIcon } from "lucide-react";
import { StatCard, type StatTone } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import type { RouterOutput } from "@/lib/trpc";

type Stats = RouterOutput["admin"]["parties"]["stats"];

const CARDS: {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: StatTone;
  value: (stats: Stats) => string;
  detail: (stats: Stats) => string;
  action?: { label: string; enabled: (stats: Stats) => boolean };
}[] = [
  {
    key: "parties",
    label: "Parties",
    icon: Users,
    tone: "primary",
    value: (stats) => String(stats.parties),
    detail: (stats) =>
      `${stats.parties - stats.taggedParties} without a team tag`,
  },
  {
    key: "players",
    label: "Players in parties",
    icon: UserRound,
    tone: "chart-2",
    value: (stats) => String(stats.players),
    detail: (stats) =>
      stats.parties === 0
        ? "No party yet"
        : `${(stats.players / stats.parties).toFixed(1)} per party on average`,
  },
  {
    key: "claims",
    label: "Claimed chunks",
    icon: Grid3X3,
    tone: "chart-3",
    value: (stats) =>
      stats.claimCount === null ? "-" : String(stats.claimCount),
    detail: (stats) =>
      stats.claimCount === null
        ? "Needs OPAC on the server"
        : `${stats.forceloadCount ?? 0} forceloaded`,
    action: {
      label: "Browse chunks",
      enabled: (stats) => (stats.claimCount ?? 0) > 0,
    },
  },
  {
    key: "tags",
    label: "Team tags",
    icon: Tag,
    tone: "chart-4",
    value: (stats) => String(stats.taggedParties),
    detail: (stats) =>
      stats.parties === 0
        ? "No party yet"
        : `${Math.round((stats.taggedParties / stats.parties) * 100)}% of parties`,
  },
];

export function PartiesStatsCards({
  stats,
  onBrowseClaims,
}: {
  stats: Stats;
  onBrowseClaims: () => void;
}) {
  const actions: Record<string, () => void> = { claims: onBrowseClaims };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon, tone, value, detail, action }) => (
        <StatCard
          key={key}
          label={label}
          value={value(stats)}
          icon={icon}
          tone={tone}
          footer={detail(stats)}
          action={
            action &&
            actions[key] &&
            action.enabled(stats) && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={actions[key]}
              >
                {action.label}
              </Button>
            )
          }
        />
      ))}
    </div>
  );
}
