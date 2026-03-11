import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";
import { Skull, Zap, Rocket } from "lucide-react";
import {
  useActiveEventTokenIds,
  useHasMarketWideEvent,
} from "../hooks/use-active-events";
import { formatPrice, getHeldPercent } from "../../format";
import { AnimatedNumber } from "../../components/AnimatedNumber";

type CategoryFilter = "stable" | "blue_chip" | "memecoin" | "seasonal";

const FILTERS: { key: CategoryFilter; label: string; dot?: string }[] = [
  { key: "stable", label: "Stable", dot: "bg-emerald-400" },
  { key: "blue_chip", label: "Blue Chip", dot: "bg-blue-400" },
  { key: "memecoin", label: "Memecoin", dot: "bg-orange-400" },
  { key: "seasonal", label: "Seasonal", dot: "bg-purple-400" },
];

export function TokenList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CategoryFilter>("stable");
  const { getPrice } = useCryptoData();
  const eventTokenIds = useActiveEventTokenIds();
  const hasMarketWideEvent = useHasMarketWideEvent();

  const { data: tokens, isLoading } = trpc.public.crypto.list.useQuery({
    category: filter,
    includesCrashed: true,
  });

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-1 rounded-lg border bg-card/30 p-1">
        {FILTERS.map(({ key, label, dot }) => (
          <button
            key={key}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              filter === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
            )}
            onClick={() => setFilter(key)}
          >
            {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
            {label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="hidden sm:flex items-center gap-4 px-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="flex-1">Token</span>
        <span className="w-24 text-right">Price</span>
        <span className="w-16 text-right">24h</span>
        <span className="w-24 text-right">Supply</span>
      </div>

      {/* Token rows */}
      {isLoading ? (
        <div className="rounded-xl border bg-card/20 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={cn(
                "h-[52px] animate-pulse bg-card/30",
                i < 6 && "border-b border-border/30",
              )}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-xl border bg-card/20 overflow-hidden">
          {tokens?.map((token) => {
            const livePrice = getPrice(token.symbol);
            const displayPrice = Number(livePrice?.price ?? token.price);
            const isCrashed = livePrice?.isCrashed ?? token.isCrashed;
            const availableSupply =
              livePrice?.availableSupply ?? token.availableSupply;
            const change24h = livePrice?.change24h ?? 0;
            const isIpo =
              !!token.ipoEndsAt && new Date(token.ipoEndsAt) > new Date();
            const hasEvent = hasMarketWideEvent || eventTokenIds.has(token.id);
            const heldPercent = getHeldPercent(
              availableSupply,
              token.totalSupply,
            );

            return (
              <div
                key={token.id}
                className={cn(
                  "group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
                  "hover:bg-muted/20",
                  isCrashed && "opacity-40",
                )}
                onClick={() => navigate(`/crypto/${token.symbol}`)}
              >
                {/* Status icon */}
                <div className="w-4 shrink-0 flex justify-center">
                  {isCrashed ? (
                    <Skull className="size-3.5 text-red-500/70" />
                  ) : isIpo ? (
                    <Rocket className="size-3.5 text-primary animate-pulse" />
                  ) : hasEvent ? (
                    <Zap className="size-3.5 text-primary/70 animate-pulse" />
                  ) : null}
                </div>

                {/* Token name + symbol */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium leading-tight truncate block">
                    {token.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {token.symbol}
                  </span>
                </div>

                {/* Price */}
                <div className="w-24 text-right">
                  <AnimatedNumber
                    value={displayPrice}
                    format={(n) => `$${formatPrice(n)}`}
                    className="text-sm font-semibold font-mono tabular-nums"
                  />
                  {/* Mobile: inline change */}
                  <span
                    className={cn(
                      "sm:hidden block text-[11px] font-mono tabular-nums",
                      change24h > 0
                        ? "text-emerald-400"
                        : change24h < 0
                          ? "text-red-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {change24h > 0 ? "+" : ""}
                    {change24h.toFixed(2)}%
                  </span>
                </div>

                {/* 24h change */}
                <span
                  className={cn(
                    "hidden sm:block w-16 text-right text-sm font-mono tabular-nums",
                    change24h > 0
                      ? "text-emerald-400"
                      : change24h < 0
                        ? "text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {change24h > 0 ? "+" : ""}
                  {change24h.toFixed(2)}%
                </span>

                {/* Supply bar */}
                <div className="hidden sm:flex items-center gap-2 w-24 justify-end">
                  <div className="w-12 h-1 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/20 transition-all duration-500"
                      style={{
                        width: `${Math.min(heldPercent, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono tabular-nums w-8 text-right">
                    {heldPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
          {(!tokens || tokens.length === 0) && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No tokens found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
