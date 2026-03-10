import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Coins, BarChart3 } from "lucide-react";

export function MarketOverview() {
  const { data, isLoading } = trpc.public.crypto.marketOverview.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Market Cap</p>
            <p className="text-lg font-bold font-mono">
              ${Number(data.totalMarketCap).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Coins className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Tokens</p>
            <p className="text-lg font-bold">{data.activeTokens}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-purple-500/10 p-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">By Category</p>
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-400">
                {data.tokensByCategory.stable} Stable
              </span>
              <span className="text-orange-400">
                {data.tokensByCategory.memecoin} Meme
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
