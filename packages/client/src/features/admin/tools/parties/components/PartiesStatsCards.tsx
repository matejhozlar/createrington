import { Grid3X3, Tag, UserRound, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import type { RouterOutput } from "@/lib/trpc";

type Stats = RouterOutput["admin"]["parties"]["stats"];

const CARDS: {
  key: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: (stats: Stats) => string;
  detail: (stats: Stats) => string;
  action?: { label: string; enabled: (stats: Stats) => boolean };
}[] = [
  {
    key: "parties",
    label: "Parties",
    icon: Users,
    iconBg: "bg-sidebar-primary/10",
    iconColor: "text-sidebar-primary",
    value: (stats) => String(stats.parties),
    detail: (stats) =>
      `${stats.parties - stats.taggedParties} without a team tag`,
  },
  {
    key: "players",
    label: "Players in parties",
    icon: UserRound,
    iconBg: "bg-chart-2/10",
    iconColor: "text-chart-2",
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
    iconBg: "bg-chart-3/10",
    iconColor: "text-chart-3",
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
    iconBg: "bg-chart-4/10",
    iconColor: "text-chart-4",
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
      {CARDS.map(
        ({
          key,
          label,
          icon: Icon,
          iconBg,
          iconColor,
          value,
          detail,
          action,
        }) => (
          <Card key={key}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-2xl">{value(stats)}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {detail(stats)}
                  </p>
                </div>
                <div
                  className={`flex size-12 items-center justify-center rounded-full ${iconBg}`}
                >
                  <Icon className={`size-6 ${iconColor}`} />
                </div>
              </div>
              {action && actions[key] && action.enabled(stats) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={actions[key]}
                >
                  {action.label}
                </Button>
              )}
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
