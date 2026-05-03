import type { LucideIcon } from "lucide-react";
import { Bot, Grid3X3, Handshake, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";

type Kpis = RouterOutput["admin"]["parties"]["kpis"];
type ChunkKpis = RouterOutput["admin"]["parties"]["chunkKpis"];
type FakeParty = RouterOutput["admin"]["parties"]["fakeParty"];

interface KpiCardDef {
  key: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const CARDS: KpiCardDef[] = [
  {
    key: "claimedChunks",
    label: "Claimed chunks",
    icon: Grid3X3,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "activeChunks",
    label: "Active chunks in game",
    icon: MapPin,
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    key: "parties",
    label: "Parties",
    icon: Users,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    key: "alliedWithFake",
    label: "Allied with Fake Player",
    icon: Handshake,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
  },
];

function getValue(
  key: string,
  kpis: Kpis,
  chunkKpis: ChunkKpis,
): { main: number; detail: string } {
  switch (key) {
    case "claimedChunks":
      return {
        main: chunkKpis.totalChunks,
        detail: `${chunkKpis.forceloadableChunks} forceloadable`,
      };
    case "activeChunks":
      return {
        main: chunkKpis.activeChunks,
        detail: `${chunkKpis.activeChunksOptedIn} from parties opted for forceloads`,
      };
    case "parties":
      return {
        main: chunkKpis.totalParties,
        detail: `${chunkKpis.partiesOptedIn} opted for Party Forceloads`,
      };
    case "alliedWithFake":
      return {
        main: kpis.alliedPlayers,
        detail: `${kpis.qualifiedPending} pending · ${kpis.notQualifiedPlayers} not qualified (server-wide)`,
      };
    default:
      return { main: 0, detail: "" };
  }
}

export function PartiesKpiCards({
  kpis,
  chunkKpis,
  fakeParty,
}: {
  kpis: Kpis;
  chunkKpis: ChunkKpis;
  fakeParty: FakeParty | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon, iconBg, iconColor }) => {
        const { main, detail } = getValue(key, kpis, chunkKpis);
        return (
          <Card key={key}>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{main}</CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
              </div>
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full",
                  iconBg,
                )}
              >
                <Icon className={cn("size-6", iconColor)} />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <FakePartyKpiCard fakeParty={fakeParty} />
    </div>
  );
}

function FakePartyKpiCard({ fakeParty }: { fakeParty: FakeParty | null }) {
  const memberCount = fakeParty?.members.length ?? 0;

  const card = (
    <Card
      className={
        fakeParty
          ? "cursor-pointer transition-colors hover:bg-accent/50"
          : undefined
      }
    >
      <CardContent className="flex items-start justify-between">
        <div>
          <CardDescription>Fake-player party</CardDescription>
          <CardTitle className="text-2xl">
            {fakeParty ? memberCount : "—"}
          </CardTitle>
          <p className="mt-2 text-xs text-muted-foreground">
            {fakeParty ? `owned by ${fakeParty.ownerName}` : "Not synced yet"}
          </p>
        </div>
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            "bg-purple-500/10",
          )}
        >
          <Bot
            className={cn(
              "size-6",
              fakeParty ? "text-purple-400" : "text-muted-foreground",
            )}
          />
        </div>
      </CardContent>
    </Card>
  );

  if (!fakeParty) return card;

  return (
    <Popover>
      <PopoverTrigger asChild>{card}</PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Owner
              </p>
              <p className="text-sm font-medium">{fakeParty.ownerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Party UUID
              </p>
              <p className="font-mono text-xs">{fakeParty.partyId}</p>
            </div>
          </div>

          {memberCount > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Members ({memberCount})
              </p>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {fakeParty.members.map((m) => (
                  <Badge
                    key={m.playerUuid}
                    variant="outline"
                    className="font-mono text-xs"
                  >
                    {m.minecraftUsername ?? m.playerUuid}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
