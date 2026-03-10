import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PieChart } from "lucide-react";

const COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
];

interface TokenDistributionProps {
  symbol: string;
}

export function TokenDistribution({ symbol }: TokenDistributionProps) {
  const { data, isLoading } = trpc.public.crypto.tokenDistribution.useQuery(
    { symbol },
    { refetchInterval: 60_000 },
  );

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChart className="size-4" />
            Ownership Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const circulatingSupply =
    Number(data.totalSupply) - Number(data.availableSupply);
  const unclaimed = Number(data.availableSupply);
  const unclaimedPercent =
    Number(data.totalSupply) > 0
      ? (unclaimed / Number(data.totalSupply)) * 100
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="size-4" />
          Ownership Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Holders</span>
          <span className="font-mono tabular-nums font-medium">{data.holderCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Circulating</span>
          <span className="font-mono tabular-nums font-medium">
            {circulatingSupply.toLocaleString()}
          </span>
        </div>

        {/* Distribution bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted flex">
          {data.holders.map((h, i) => (
            <div
              key={h.playerName}
              className={cn(COLORS[i % COLORS.length], "h-full transition-all duration-300")}
              style={{ width: `${h.percentage}%` }}
              title={`${h.playerName}: ${h.percentage}%`}
            />
          ))}
          {unclaimedPercent > 0 && (
            <div
              className="h-full bg-muted-foreground/20"
              style={{ width: `${unclaimedPercent}%` }}
              title={`Unclaimed: ${unclaimedPercent.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="space-y-1.5">
          {data.holders.slice(0, 8).map((h, i) => (
            <div key={h.playerName} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "size-2.5 rounded-full shrink-0",
                    COLORS[i % COLORS.length],
                  )}
                />
                <span className="text-muted-foreground truncate">
                  {h.playerName}
                </span>
              </div>
              <div className="flex gap-3 font-mono tabular-nums shrink-0">
                <span>{Number(h.amount).toLocaleString()}</span>
                <span className="text-muted-foreground w-12 text-right">
                  {h.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
          {data.holders.length > 8 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{data.holders.length - 8} more holders
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
