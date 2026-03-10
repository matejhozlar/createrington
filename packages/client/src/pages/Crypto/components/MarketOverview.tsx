import { trpc } from "@/lib/trpc";

export function MarketOverview() {
  const { data, isLoading } = trpc.public.crypto.marketOverview.useQuery();

  if (isLoading || !data) {
    return <div className="h-14 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border px-5 py-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Market Cap
        </p>
        <p className="text-lg font-semibold font-mono">
          ${Number(data.totalMarketCap).toLocaleString()}
        </p>
      </div>

      <div className="hidden sm:block h-8 w-px bg-border" />

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Active Tokens
        </p>
        <p className="text-lg font-semibold">{data.activeTokens}</p>
      </div>

      <div className="hidden sm:block h-8 w-px bg-border" />

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          By Type
        </p>
        <div className="flex gap-3 text-sm">
          <span className="text-emerald-400">
            {data.tokensByCategory.stable} Stable
          </span>
          <span className="text-orange-400">
            {data.tokensByCategory.memecoin} Meme
          </span>
        </div>
      </div>
    </div>
  );
}
