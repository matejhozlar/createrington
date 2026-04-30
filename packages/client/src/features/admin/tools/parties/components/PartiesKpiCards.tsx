import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Grid3X3,
  Handshake,
  MapPin,
  Users,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";

type Kpis = RouterOutput["admin"]["parties"]["kpis"];
type ChunkKpis = RouterOutput["admin"]["parties"]["chunkKpis"];

interface KpiCardDef {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const CARDS: KpiCardDef[] = [
  {
    key: "totalChunks",
    label: "Claimed chunks",
    description: "Total across all players",
    icon: Grid3X3,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "forceloadableChunks",
    label: "Forceloadable",
    description: "Chunks marked as forceloadable",
    icon: Zap,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  {
    key: "activeChunks",
    label: "Active chunks",
    description: "Currently loaded in-game",
    icon: MapPin,
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    key: "totalParties",
    label: "Parties",
    description: "With claimed chunks",
    icon: Users,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    key: "alliedParties",
    label: "Allied parties",
    description: "Allied with the fake-player party",
    icon: Handshake,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
  {
    key: "qualified",
    label: "Qualified players",
    description: "Active / pending ally qualification",
    icon: CheckCircle2,
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-500",
  },
];

function getValue(
  key: string,
  kpis: Kpis,
  chunkKpis: ChunkKpis,
): { main: number; detail?: string } {
  switch (key) {
    case "totalChunks":
      return { main: chunkKpis.totalChunks };
    case "forceloadableChunks":
      return { main: chunkKpis.forceloadableChunks };
    case "activeChunks":
      return { main: chunkKpis.activeChunks };
    case "totalParties":
      return {
        main: chunkKpis.totalParties,
        detail: `${chunkKpis.partiesOptedIn} opted in`,
      };
    case "alliedParties":
      return { main: kpis.alliedParties };
    case "qualified":
      return {
        main: kpis.qualifiedActive + kpis.qualifiedPending,
        detail: `${kpis.qualifiedActive} active · ${kpis.qualifiedPending} pending`,
      };
    default:
      return { main: 0 };
  }
}

export function PartiesKpiCards({
  kpis,
  chunkKpis,
}: {
  kpis: Kpis;
  chunkKpis: ChunkKpis;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {CARDS.map(
        ({ key, label, description, icon: Icon, iconBg, iconColor }) => {
          const { main, detail } = getValue(key, kpis, chunkKpis);
          return (
            <Card key={key}>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-2xl">{main}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {detail ?? description}
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
          );
        },
      )}
    </div>
  );
}
