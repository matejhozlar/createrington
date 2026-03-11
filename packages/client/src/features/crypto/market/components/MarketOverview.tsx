import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold font-mono tabular-nums",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function MarketOverview() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.public.crypto.marketOverview.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  if (isLoading || !data) {
    return (
      <div className="h-5 w-64 animate-pulse rounded bg-muted/30" />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Stat
        label="Market Cap"
        value={`$${Number(data.totalMarketCap).toLocaleString()}`}
      />
      <div className="h-3.5 w-px bg-border/60" />
      <Stat
        label="24h Vol"
        value={`$${Number(data.totalVolume24h).toLocaleString()}`}
      />
      {data.topGainer && (
        <>
          <div className="h-3.5 w-px bg-border/60" />
          <button
            className="flex items-center gap-2 transition-colors hover:opacity-80"
            onClick={() => navigate(`/crypto/${data.topGainer!.symbol}`)}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Top Gainer
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-emerald-400">
              {data.topGainer.symbol}{" "}
              +{data.topGainer.change24h.toFixed(1)}%
            </span>
          </button>
        </>
      )}
      {data.topLoser && (
        <>
          <div className="h-3.5 w-px bg-border/60" />
          <button
            className="flex items-center gap-2 transition-colors hover:opacity-80"
            onClick={() => navigate(`/crypto/${data.topLoser!.symbol}`)}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Top Loser
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-red-400">
              {data.topLoser.symbol}{" "}
              {data.topLoser.change24h.toFixed(1)}%
            </span>
          </button>
        </>
      )}
    </div>
  );
}
