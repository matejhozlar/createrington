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
import { ArrowLeft } from "lucide-react";

type LeaderboardType = "networth" | "pnl" | "volume";

const RANK_COLORS: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-zinc-300",
  3: "text-amber-600",
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
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry, index) => {
              const rank = index + 1;
              const color = RANK_COLORS[rank];

              return (
                <TableRow
                  key={entry.playerUuid}
                  className={cn(rank <= 3 && "font-semibold")}
                >
                  <TableCell>
                    <span className={cn("text-sm tabular-nums", color ?? "text-muted-foreground pl-1")}>
                      {rank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={color}>{entry.playerName}</span>
                  </TableCell>
                  <TableCell className={cn("text-right font-mono", color)}>
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
      <div className="px-5 md:px-8 pt-6 pb-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2"
            onClick={() => navigate("/crypto")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Market
          </Button>

          <h1 className="text-3xl md:text-4xl font-semibold">Leaderboard</h1>
        </div>
      </div>

      <div className="px-5 md:px-8">
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
