import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";
import { Skull, Zap, Rocket, Search, X } from "lucide-react";
import { Loading } from "@/components/loading-spinner";
import {
  useActiveEventTokenIds,
  useHasMarketWideEvent,
} from "../hooks/use-active-events";
import { formatPrice, changeColor, formatChangePercent } from "../../format";
import { AnimatedNumber } from "../../components/AnimatedNumber";

type CategoryFilter = "stable" | "blue_chip" | "memecoin" | "seasonal";

const FILTERS: { key: CategoryFilter; label: string; dot?: string }[] = [
  { key: "stable", label: "Stable", dot: "bg-emerald-400" },
  { key: "memecoin", label: "Memecoin", dot: "bg-orange-400" },
  { key: "blue_chip", label: "Blue Chip", dot: "bg-blue-400" },
  { key: "seasonal", label: "Seasonal", dot: "bg-purple-400" },
];

export function TokenList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CategoryFilter>("stable");
  const [search, setSearch] = useState("");
  const { getPrice } = useCryptoData();
  const eventTokenIds = useActiveEventTokenIds();
  const hasMarketWideEvent = useHasMarketWideEvent();

  const { data: tokens, isLoading } = trpc.public.crypto.list.useQuery({
    category: filter,
    includesCrashed: true,
  });

  const filteredTokens = useMemo(() => {
    if (!tokens || !search.trim()) return tokens;
    const q = search.trim().toLowerCase();
    return tokens.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
    );
  }, [tokens, search]);

  return (
    <div className="space-y-3">
      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
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
        <div className="relative sm:flex-1 sm:max-w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tokens..."
            className="h-[34px] w-full rounded-lg border bg-card pl-8 pr-8 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden sm:flex items-center gap-4 px-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="flex-1">Token</span>
        <span className="w-24 text-right">Price</span>
        <span className="w-16 text-right">24h</span>
      </div>

      {/* Token rows */}
      {isLoading ? (
        <Loading
          mode="inline"
          size="large"
          text="Loading tokens..."
          className="py-12"
        />
      ) : (
        <div className="divide-y divide-border/30 rounded-xl border bg-card/20 overflow-hidden">
          {filteredTokens?.map((token) => {
            const livePrice = getPrice(token.symbol);
            const displayPrice = Number(livePrice?.price ?? token.price);
            const isCrashed = livePrice?.isCrashed ?? token.isCrashed;
            const change24h = livePrice?.change24h ?? token.change24h;
            const isIpo =
              !!token.ipoEndsAt && new Date(token.ipoEndsAt) > new Date();
            const hasEvent = hasMarketWideEvent || eventTokenIds.has(token.id);

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
                    <Skull className="size-3.5 text-destructive/70" />
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
                      changeColor(change24h),
                    )}
                  >
                    {formatChangePercent(change24h)}
                  </span>
                </div>

                {/* 24h change */}
                <span
                  className={cn(
                    "hidden sm:block w-16 text-right text-sm font-mono tabular-nums",
                    changeColor(change24h),
                  )}
                >
                  {formatChangePercent(change24h)}
                </span>
              </div>
            );
          })}
          {(!filteredTokens || filteredTokens.length === 0) && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search.trim()
                ? `No tokens matching "${search.trim()}"`
                : "No tokens found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
