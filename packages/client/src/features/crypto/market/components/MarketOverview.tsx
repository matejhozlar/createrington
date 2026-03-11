import { trpc } from "@/lib/trpc";
import { BarChart3, Activity, Layers } from "lucide-react";

export function MarketOverview() {
  const { data, isLoading } = trpc.public.crypto.marketOverview.useQuery();

  if (isLoading || !data) {
    return <div className="h-[72px] animate-pulse rounded-xl bg-card border" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl border bg-border/50 overflow-hidden">
      <div className="flex items-center gap-3 bg-card p-4 transition-colors hover:bg-card/80">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 className="size-4 text-primary" />
        </div>
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Market Cap
          </span>
          <span className="text-lg font-bold font-mono tabular-nums tracking-tight">
            ${Number(data.totalMarketCap).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-card p-4 transition-colors hover:bg-card/80">
        <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
          <Activity className="size-4 text-emerald-400" />
        </div>
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Active Tokens
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight">
            {data.activeTokens}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-card p-4 transition-colors hover:bg-card/80">
        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
          <Layers className="size-4 text-blue-400" />
        </div>
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
            By Category
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="font-mono tabular-nums font-semibold">
                {data.tokensByCategory.stable}
              </span>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Stable
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <span className="size-2 rounded-full bg-orange-400" />
              <span className="font-mono tabular-nums font-semibold">
                {data.tokensByCategory.memecoin}
              </span>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                Meme
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
