import { trpc } from "@/lib/trpc";
import { BarChart3, Activity, Layers } from "lucide-react";

export function MarketOverview() {
  const { data, isLoading } = trpc.public.crypto.marketOverview.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl bg-card border" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="size-4 text-primary" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Market Cap
          </span>
        </div>
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
          ${Number(data.totalMarketCap).toLocaleString()}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 transition-colors hover:border-emerald-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Activity className="size-4 text-emerald-400" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Active Tokens
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">
          {data.activeTokens}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 transition-colors hover:border-blue-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
            <Layers className="size-4 text-blue-400" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            By Category
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="font-mono tabular-nums font-semibold">
              {data.tokensByCategory.stable}
            </span>
            <span className="text-muted-foreground text-xs">Stable</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="size-2 rounded-full bg-orange-400" />
            <span className="font-mono tabular-nums font-semibold">
              {data.tokensByCategory.memecoin}
            </span>
            <span className="text-muted-foreground text-xs">Meme</span>
          </span>
        </div>
      </div>
    </div>
  );
}
