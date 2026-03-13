import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useCryptoData } from "@/contexts/crypto-data";
import { Loading } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skull, Rocket, TrendingUp, TrendingDown, Star } from "lucide-react";
import { TradePanel } from "./components/TradePanel";
// import { OrderBook } from "./components/OrderBook";
import { PriceChart } from "./components/PriceChart";
import { TokenDistribution } from "./components/TokenDistribution";
import { formatPrice } from "../format";

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

export function TokenDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPrice } = useCryptoData();
  const utils = trpc.useUtils();

  const { data: token, isLoading } = trpc.public.crypto.get.useQuery(
    { symbol: symbol ?? "" },
    { enabled: !!symbol },
  );

  const { data: watchlist } = trpc.user.crypto.watchlistList.useQuery(
    undefined,
    { enabled: !!user },
  );
  const isWatchlisted = watchlist?.some((w) => w.symbol === symbol) ?? false;

  const addToWatchlist = trpc.user.crypto.watchlistAdd.useMutation({
    onSuccess: () => utils.user.crypto.watchlistList.invalidate(),
  });
  const removeFromWatchlist = trpc.user.crypto.watchlistRemove.useMutation({
    onSuccess: () => utils.user.crypto.watchlistList.invalidate(),
  });

  if (isLoading) {
    return (
      <Loading
        mode="inline"
        size="large"
        text="Loading token..."
        className="py-12"
      />
    );
  }

  if (!token) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-muted-foreground">Token not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/crypto")}
        >
          Back to Market
        </Button>
      </div>
    );
  }

  const livePrice = getPrice(token.symbol);
  const displayPrice = livePrice?.price ?? token.price;
  const isCrashed = livePrice?.isCrashed ?? token.isCrashed;
  const change24h = livePrice?.change24h ?? 0;
  const availableSupply = livePrice
    ? Number(livePrice.availableSupply)
    : Number(token.availableSupply);

  const isIpo = !!token.ipoEndsAt && new Date(token.ipoEndsAt) > new Date();
  const price = Number(displayPrice);
  const totalSupply = Number(token.totalSupply);
  const circulatingSupply = totalSupply - availableSupply;
  const marketCap = price * circulatingSupply;
  const volume24h = livePrice ? Number(livePrice.volume24h) : 0;
  const heldPercent =
    totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        {/* Token info */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {token.name}
                </h1>
                {user && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8",
                      isWatchlisted
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-muted-foreground/50 hover:text-amber-400",
                    )}
                    disabled={
                      addToWatchlist.isPending || removeFromWatchlist.isPending
                    }
                    onClick={() =>
                      isWatchlisted
                        ? removeFromWatchlist.mutate({ symbol: token.symbol })
                        : addToWatchlist.mutate({ symbol: token.symbol })
                    }
                  >
                    <Star
                      className={cn("size-4", isWatchlisted && "fill-current")}
                    />
                  </Button>
                )}
                <Badge
                  variant="outline"
                  className={cn("text-xs", CATEGORY_COLORS[token.category])}
                >
                  {CATEGORY_LABELS[token.category]}
                </Badge>
                {isCrashed && (
                  <Badge variant="destructive" className="gap-1">
                    <Skull className="size-3" />
                    Crashed
                  </Badge>
                )}
                {isIpo && (
                  <Badge
                    variant="outline"
                    className="gap-1 text-primary border-primary/30 bg-primary/10"
                  >
                    <Rocket className="size-3" />
                    IPO
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {token.symbol}
              </p>
              {token.description && (
                <p className="text-sm text-muted-foreground max-w-lg">
                  {token.description}
                </p>
              )}
            </div>

            {/* Price display */}
            <div className="text-left sm:text-right shrink-0">
              <p className="text-3xl md:text-4xl font-bold font-mono tabular-nums tracking-tight">
                ${formatPrice(displayPrice)}
              </p>
              {!isCrashed && change24h !== 0 && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 mt-1 rounded-full px-2.5 py-0.5 text-sm font-mono tabular-nums font-medium",
                    change24h > 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-red-400 bg-red-500/10",
                  )}
                >
                  {change24h > 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {change24h > 0 ? "+" : ""}
                  {change24h.toFixed(2)}%
                </div>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px rounded-xl border bg-border/50 overflow-hidden">
            <div className="bg-card/70 px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Market Cap
              </p>
              <p className="mt-0.5 text-base font-semibold font-mono tabular-nums">
                $
                {marketCap.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="bg-card/70 px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                24h Volume
              </p>
              <p className="mt-0.5 text-base font-semibold font-mono tabular-nums">
                {volume24h > 0 ? (
                  volume24h.toLocaleString()
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>
            <div className="bg-card/70 px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Circulating
              </p>
              <p className="mt-0.5 text-base font-semibold font-mono tabular-nums">
                {circulatingSupply.toLocaleString()}
                <span className="text-xs text-muted-foreground font-normal">
                  {" "}
                  /{" "}
                  {totalSupply >= 999999999
                    ? "∞"
                    : totalSupply.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="bg-card/70 px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                % Held
              </p>
              <p className="mt-0.5 text-base font-semibold font-mono tabular-nums">
                {heldPercent.toFixed(1)}%
              </p>
            </div>
            {token.floorPrice && (
              <div className="bg-card/70 px-4 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Floor
                </p>
                <p className="mt-0.5 text-base font-semibold font-mono tabular-nums">
                  ${formatPrice(token.floorPrice)}
                </p>
              </div>
            )}
            <div className="bg-card/70 px-4 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Listed
              </p>
              <p className="mt-0.5 text-base font-semibold">
                {new Date(token.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <PriceChart symbol={token.symbol} />
            <TokenDistribution symbol={token.symbol} />
            {/* OrderBook hidden until we decide on unlock/premium gating */}
            {/* <OrderBook /> */}
          </div>

          <div className="lg:sticky lg:top-15 lg:self-start">
            <TradePanel
              symbol={token.symbol}
              price={displayPrice}
              category={token.category}
              isCrashed={isCrashed}
              ipoEndsAt={token.ipoEndsAt}
              ipoPrice={token.ipoPrice}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
