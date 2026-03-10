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
import { Trophy, ArrowLeft, Medal } from "lucide-react";

type LeaderboardType = "networth" | "pnl" | "volume";

/**
 * Fetches and renders a ranked table for a specific leaderboard category.
 *
 * @param type - The ranking metric to display ("networth", "pnl", or "volume")
 */
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
              const isTop3 = rank <= 3;

              return (
                <TableRow
                  key={entry.playerUuid}
                  className={cn(isTop3 && "font-semibold")}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {rank === 1 && (
                        <Medal className="h-5 w-5 text-yellow-400" />
                      )}
                      {rank === 2 && (
                        <Medal className="h-5 w-5 text-gray-300" />
                      )}
                      {rank === 3 && (
                        <Medal className="h-5 w-5 text-amber-600" />
                      )}
                      {rank > 3 && (
                        <span className="pl-1 text-sm text-muted-foreground">
                          {rank}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        rank === 1 && "text-yellow-400",
                        rank === 2 && "text-gray-300",
                        rank === 3 && "text-amber-600",
                      )}
                    >
                      {entry.playerName}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      rank === 1 && "text-yellow-400",
                      rank === 2 && "text-gray-300",
                      rank === 3 && "text-amber-600",
                    )}
                  >
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

/** Crypto leaderboard page — ranks players by net worth, P&L, or trading volume via switchable tabs. */
export function Leaderboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => navigate("/crypto")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Market
        </Button>
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-400" />
          <h1 className="text-2xl font-bold">Leaderboard</h1>
        </div>
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
  );
}
