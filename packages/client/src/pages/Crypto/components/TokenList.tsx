import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";
import { Badge } from "@/components/ui/badge";
import { Skull, TrendingUp, TrendingDown, Zap, Rocket } from "lucide-react";
import {
  useActiveEventTokenIds,
  useHasMarketWideEvent,
} from "./useActiveEvents";
import { formatPrice, formatSupply, getHeldPercent } from "./format";

const CATEGORY_ACCENT: Record<string, string> = {
  stable: "bg-emerald-400",
  blue_chip: "bg-blue-400",
  memecoin: "bg-orange-400",
  seasonal: "bg-purple-400",
};

const CATEGORY_BAR: Record<string, string> = {
  stable: "bg-emerald-400/40",
  blue_chip: "bg-blue-400/40",
  memecoin: "bg-orange-400/40",
  seasonal: "bg-purple-400/40",
};

const CATEGORY_COLORS: Record<string, string> = {
  stable: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  blue_chip: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  memecoin: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  seasonal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  stable: "Stable",
  blue_chip: "Blue Chip",
  memecoin: "Memecoin",
  seasonal: "Seasonal",
};

type CategoryFilter = "all" | "stable" | "blue_chip" | "memecoin" | "seasonal";

const FILTERS: { key: CategoryFilter; label: string; dot?: string }[] = [
  { key: "all", label: "All Tokens" },
  { key: "stable", label: "Stable", dot: "bg-emerald-400" },
  { key: "blue_chip", label: "Blue Chip", dot: "bg-blue-400" },
  { key: "memecoin", label: "Memecoin", dot: "bg-orange-400" },
  { key: "seasonal", label: "Seasonal", dot: "bg-purple-400" },
];

export function TokenList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const { getPrice } = useCryptoData();

  const eventTokenIds = useActiveEventTokenIds();
  const hasMarketWideEvent = useHasMarketWideEvent();

  const { data: tokens, isLoading } = trpc.public.crypto.list.useQuery(
    filter === "all"
      ? { includesCrashed: true }
      : { category: filter, includesCrashed: true },
  );

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card/50 p-1.5">
        {FILTERS.map(({ key, label, dot }) => (
          <button
            key={key}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              filter === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
            onClick={() => setFilter(key)}
          >
            {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[136px] animate-pulse rounded-xl bg-card/30 border"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tokens?.map((token) => {
            const livePrice = getPrice(token.symbol);
            const displayPrice = livePrice?.price ?? token.price;
            const isCrashed = livePrice?.isCrashed ?? token.isCrashed;
            const availableSupply =
              livePrice?.availableSupply ?? token.availableSupply;
            const change24h = livePrice?.change24h ?? 0;
            const isIpo =
              !!token.ipoEndsAt && new Date(token.ipoEndsAt) > new Date();
            const hasEvent =
              hasMarketWideEvent || eventTokenIds.has(token.id);
            const heldPercent = getHeldPercent(
              availableSupply,
              token.totalSupply,
            );

            return (
              <div
                key={token.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-card/30 p-4 transition-all duration-200 cursor-pointer",
                  "hover:bg-card/50 hover:border-border/80 hover:shadow-md hover:shadow-black/10",
                  isCrashed && "opacity-45",
                )}
                onClick={() => navigate(`/crypto/${token.symbol}`)}
              >
                {/* Category accent line */}
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl",
                    CATEGORY_ACCENT[token.category],
                  )}
                />

                {/* Header: name + category */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {isCrashed && (
                      <Skull className="size-4 text-red-500 shrink-0" />
                    )}
                    {!isCrashed && isIpo && (
                      <Rocket className="size-4 text-primary animate-pulse shrink-0" />
                    )}
                    {!isCrashed && !isIpo && hasEvent && (
                      <Zap className="size-4 text-yellow-400 animate-pulse shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">
                        {token.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {token.symbol}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] shrink-0 ml-2",
                      CATEGORY_COLORS[token.category],
                    )}
                  >
                    {CATEGORY_LABELS[token.category]}
                  </Badge>
                </div>

                {/* Price + change */}
                <div className="flex items-end justify-between mb-3">
                  <p className="text-xl font-bold font-mono tabular-nums tracking-tight">
                    ${formatPrice(displayPrice)}
                  </p>
                  {isCrashed ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Crashed
                    </Badge>
                  ) : isIpo ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-primary border-primary/30 bg-primary/10"
                    >
                      IPO
                    </Badge>
                  ) : change24h !== 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono tabular-nums font-medium",
                        change24h > 0
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400",
                      )}
                    >
                      {change24h > 0 ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                      {change24h > 0 ? "+" : ""}
                      {change24h.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">
                      0.00%
                    </span>
                  )}
                </div>

                {/* Supply bar */}
                <div className="space-y-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted/20">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        CATEGORY_BAR[token.category],
                      )}
                      style={{
                        width: `${Math.min(heldPercent, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    {formatSupply(
                      String(availableSupply),
                      String(token.totalSupply),
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          {(!tokens || tokens.length === 0) && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No tokens found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
