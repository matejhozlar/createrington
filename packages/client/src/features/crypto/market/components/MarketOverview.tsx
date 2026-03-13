import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";

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
        className={cn("text-sm font-bold font-mono tabular-nums", className)}
      >
        {value}
      </span>
    </div>
  );
}

export function MarketOverview() {
  const navigate = useNavigate();
  const { overview } = useCryptoData();

  if (!overview) {
    return <div className="h-5 w-64 animate-pulse rounded bg-muted/30" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Stat
        label="Market Cap"
        value={`$${Number(overview.totalMarketCap).toLocaleString()}`}
      />
      <div className="h-3.5 w-px bg-border/60" />
      <Stat
        label="24h Vol"
        value={`$${Number(overview.totalVolume24h).toLocaleString()}`}
      />
      {overview.topGainer && (
        <>
          <div className="h-3.5 w-px bg-border/60" />
          <button
            className="flex items-center gap-2 transition-colors hover:opacity-80"
            onClick={() => navigate(`/crypto/${overview.topGainer!.symbol}`)}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Top Gainer
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-emerald-400">
              {overview.topGainer.symbol} +
              {overview.topGainer.change24h.toFixed(1)}%
            </span>
          </button>
        </>
      )}
      {overview.topLoser && (
        <>
          <div className="h-3.5 w-px bg-border/60" />
          <button
            className="flex items-center gap-2 transition-colors hover:opacity-80"
            onClick={() => navigate(`/crypto/${overview.topLoser!.symbol}`)}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Top Loser
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-red-400">
              {overview.topLoser.symbol}{" "}
              {overview.topLoser.change24h.toFixed(1)}%
            </span>
          </button>
        </>
      )}
    </div>
  );
}
