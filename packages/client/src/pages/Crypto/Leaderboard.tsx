import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Trophy, Medal, Crown } from "lucide-react";

type LeaderboardType = "networth" | "pnl" | "volume";

const RANK_STYLES: Record<number, { color: string; icon: typeof Crown; iconColor: string; bg: string }> = {
  1: { color: "text-yellow-400", icon: Crown, iconColor: "text-yellow-400", bg: "bg-yellow-400/[0.06]" },
  2: { color: "text-zinc-300", icon: Medal, iconColor: "text-zinc-300", bg: "bg-zinc-300/[0.04]" },
  3: { color: "text-amber-600", icon: Medal, iconColor: "text-amber-600", bg: "bg-amber-600/[0.04]" },
};

function LeaderboardTable({ type }: { type: LeaderboardType }) {
  const { data, isLoading } = trpc.public.crypto.leaderboard.useQuery(
    { type },
    { refetchInterval: 60_000 },
  );

  if (isLoading) {
    return <Loading mode="inline" size="large" text="Loading leaderboard..." className="py-12" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No trading activity yet
      </div>
    );
  }

  return (
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
            {data.map((entry, index) => {
              const rank = index + 1;
              const rankStyle = RANK_STYLES[rank];

              return (
                <TableRow
                  key={entry.playerUuid}
                  className={cn(
                    "border-b border-border/30 last:border-0",
                    rank <= 3 && "font-semibold",
                    rankStyle?.bg,
                  )}
                >
                  <TableCell>
                    {rankStyle ? (
                      <div className="flex items-center gap-1.5">
                        <rankStyle.icon className={cn("size-4", rankStyle.iconColor)} />
                        <span className={cn("text-sm tabular-nums", rankStyle.color)}>
                          {rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums text-muted-foreground pl-1">
                        {rank}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={rankStyle?.color}>
                      {entry.playerName}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right font-mono tabular-nums", rankStyle?.color)}>
                    ${Number(entry.value).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function Leaderboard() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col pb-16">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/[0.03] via-transparent to-transparent" />
        <div className="relative px-5 md:px-8 pt-6 pb-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/crypto")}
            >
              <ArrowLeft className="size-4" />
              Back to Market
            </Button>

            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-yellow-500/10 ring-1 ring-yellow-500/20">
                <Trophy className="size-5 text-yellow-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Leaderboard
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 pt-6">
        <div className="max-w-7xl mx-auto">
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
    </div>
  );
}
