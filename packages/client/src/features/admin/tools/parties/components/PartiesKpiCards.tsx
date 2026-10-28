import { Grid3X3, Tag, UserRound, Users, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import type { RouterOutput } from "@/lib/trpc";

type Kpis = RouterOutput["admin"]["parties"]["kpis"];

const CARDS: {
  key: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  value: (kpis: Kpis) => string;
  detail: (kpis: Kpis) => string;
}[] = [
  {
    key: "parties",
    label: "Parties",
    icon: Users,
    iconBg: "bg-sidebar-primary/10",
    iconColor: "text-sidebar-primary",
    value: (kpis) => String(kpis.parties),
    detail: (kpis) => `${kpis.parties - kpis.taggedParties} without a team tag`,
  },
  {
    key: "players",
    label: "Players in parties",
    icon: UserRound,
    iconBg: "bg-chart-2/10",
    iconColor: "text-chart-2",
    value: (kpis) => String(kpis.players),
    detail: (kpis) =>
      kpis.parties === 0
        ? "No party yet"
        : `${(kpis.players / kpis.parties).toFixed(1)} per party on average`,
  },
  {
    key: "claims",
    label: "Claimed chunks",
    icon: Grid3X3,
    iconBg: "bg-chart-3/10",
    iconColor: "text-chart-3",
    value: (kpis) => (kpis.claimCount === null ? "-" : String(kpis.claimCount)),
    detail: (kpis) =>
      kpis.claimCount === null
        ? "Needs OPAC on the server"
        : `${kpis.forceloadCount ?? 0} forceloaded`,
  },
  {
    key: "tags",
    label: "Team tags",
    icon: Tag,
    iconBg: "bg-chart-4/10",
    iconColor: "text-chart-4",
    value: (kpis) => String(kpis.taggedParties),
    detail: (kpis) =>
      kpis.parties === 0
        ? "No party yet"
        : `${Math.round((kpis.taggedParties / kpis.parties) * 100)}% of parties`,
  },
];

export function PartiesKpiCards({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(
        ({ key, label, icon: Icon, iconBg, iconColor, value, detail }) => (
          <Card key={key}>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value(kpis)}</CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {detail(kpis)}
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
