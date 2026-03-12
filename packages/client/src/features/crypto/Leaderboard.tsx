import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crown, Medal } from "lucide-react";
import { MinecraftAvatar } from "@/components/minecraft-avatar";

type LeaderboardType = "networth" | "pnl" | "volume";

const PODIUM_STYLES = [
  {
    border: "border-yellow-400/30",
    bg: "bg-yellow-400/[0.06]",
    accent: "text-yellow-400",
    ring: "ring-yellow-400/20",
    icon: Crown,
    label: "1st",
    glow: "shadow-yellow-400/5",
  },
  {
    border: "border-zinc-300/20",
    bg: "bg-zinc-300/[0.04]",
    accent: "text-zinc-300",
    ring: "ring-zinc-300/15",
    icon: Medal,
    label: "2nd",
    glow: "",
  },
  {
    border: "border-amber-600/20",
    bg: "bg-amber-600/[0.04]",
    accent: "text-amber-600",
    ring: "ring-amber-600/15",
    icon: Medal,
    label: "3rd",
    glow: "",
  },
];

function formatValue(value: string | number) {
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function LeaderboardTable({ type }: { type: LeaderboardType }) {
  const { data, isLoading } = trpc.public.crypto.leaderboard.useQuery(
    { type },
    { refetchInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <Loading
        mode="inline"
        size="large"
        text="Loading leaderboard..."
        className="py-12"
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No trading activity yet
      </div>
    );
  }

  const podium = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="space-y-5">
      {/* Podium cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {podium.map((entry, index) => {
          const style = PODIUM_STYLES[index];
          const Icon = style.icon;

          return (
            <div
              key={entry.playerUuid}
              className={cn(
                "relative overflow-hidden rounded-xl border p-4 ring-1 transition-colors",
                style.border,
                style.bg,
                style.ring,
                style.glow && `shadow-lg ${style.glow}`,
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={cn("size-5", style.accent)} />
                  <span className={cn("text-sm font-bold", style.accent)}>
                    {style.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-widest",
                    style.accent,
                  )}
                >
                  Rank #{index + 1}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <MinecraftAvatar
                  username={entry.playerName}
                  uuid={entry.playerUuid}
                  size={28}
                />
                <p className="text-base font-semibold truncate">
                  {entry.playerName}
                </p>
              </div>
              <p
                className={cn(
                  "text-xl font-bold font-mono tabular-nums",
                  style.accent,
                )}
              >
                {formatValue(entry.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rest of the leaderboard */}
      {rest.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-[11px] font-medium uppercase tracking-wider">
                    Rank
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Player
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                    Value
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rest.map((entry, index) => {
                  const rank = index + 4;
                  return (
                    <TableRow
                      key={entry.playerUuid}
                      className="border-b border-border/30 last:border-0"
                    >
                      <TableCell>
                        <span className="text-sm tabular-nums text-muted-foreground pl-1">
                          {rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MinecraftAvatar
                            username={entry.playerName}
                            uuid={entry.playerUuid}
                            size={24}
                          />
                          <span>{entry.playerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatValue(entry.value)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function Leaderboard() {
  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">Leaderboard</h1>
        </div>
        <Tabs defaultValue="networth">
          <TabsList>
            <TabsTrigger value="networth">Net Worth</TabsTrigger>
            <TabsTrigger value="pnl">P&L</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
          </TabsList>

          <TabsContent value="networth">
            <LeaderboardTable type="networth" />
          </TabsContent>

          <TabsContent value="pnl">
            <LeaderboardTable type="pnl" />
          </TabsContent>

          <TabsContent value="volume">
            <LeaderboardTable type="volume" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
