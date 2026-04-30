import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Handshake, MapPin, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";

type Kpis = RouterOutput["admin"]["parties"]["kpis"];

const CARDS: {
  key: keyof Kpis | "qualified";
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    key: "totalParties",
    label: "Total parties",
    description: "Synced from opac-fp",
    icon: Users,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "alliedParties",
    label: "Allied parties",
    description: "Currently allied with the fake-player party",
    icon: Handshake,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    key: "partiesWithActiveForceloads",
    label: "Active forceloads",
    description: "Parties with at least one chunk loaded",
    icon: MapPin,
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    key: "qualified",
    label: "Qualified players",
    description: "Active / pending ally qualification",
    icon: CheckCircle2,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
];

export function PartiesKpiCards({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(
        ({ key, label, description, icon: Icon, iconBg, iconColor }) => (
          <Card key={key}>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>{label}</CardDescription>
                {key === "qualified" ? (
                  <>
                    <CardTitle className="text-2xl">
                      {kpis.qualifiedActive + kpis.qualifiedPending}
                    </CardTitle>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {kpis.qualifiedActive} active · {kpis.qualifiedPending}{" "}
                      pending
                    </p>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl">{kpis[key]}</CardTitle>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {description}
                    </p>
                  </>
                )}
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
