import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";
import { Loading } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Skull, Rocket, TrendingUp, TrendingDown } from "lucide-react";
import { TradePanel } from "./components/TradePanel";
import { OrderBook } from "./components/OrderBook";
import { PriceChart } from "./components/PriceChart";
import { TokenDistribution } from "./components/TokenDistribution";
import { formatPrice } from "./components/format";

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
  const { getPrice } = useCryptoData();

  const { data: token, isLoading } = trpc.public.crypto.get.useQuery(
    { symbol: symbol ?? "" },
    { enabled: !!symbol },
  );

  if (isLoading) {
    return <Loading mode="inline" size="large" text="Loading token..." className="py-12" />;
  }

  if (!token) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-muted-foreground">Token not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/crypto")}>
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

  return (
    <div className="flex flex-1 flex-col pb-16">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
        <div className="relative px-5 md:px-8 pt-6 pb-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/crypto")}
            >
              <ArrowLeft className="size-4" />
              Back to Market
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {token.name}
                  </h1>
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
                <p className="text-4xl font-bold font-mono tabular-nums tracking-tight">
                  ${formatPrice(displayPrice)}
                </p>
                {!isCrashed && change24h !== 0 && (
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 mt-1 text-sm font-mono tabular-nums font-medium",
                      change24h > 0 ? "text-emerald-400" : "text-red-400",
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

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-card/50 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Market Cap
                </p>
                <p className="mt-1 text-lg font-semibold font-mono tabular-nums">
                  ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-xl border bg-card/50 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Circulating
                </p>
                <p className="mt-1 text-lg font-semibold font-mono tabular-nums">
                  {circulatingSupply.toLocaleString()}
                  <span className="text-sm text-muted-foreground font-normal">
                    {" "}/ {totalSupply >= 999999999 ? "∞" : totalSupply.toLocaleString()}
                  </span>
                </p>
              </div>
              {token.floorPrice && (
                <div className="rounded-xl border bg-card/50 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Floor
                  </p>
                  <p className="mt-1 text-lg font-semibold font-mono tabular-nums">
                    ${Number(token.floorPrice).toFixed(2)}
                  </p>
                </div>
              )}
              <div className="rounded-xl border bg-card/50 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Listed
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {new Date(token.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 pt-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PriceChart symbol={token.symbol} />
            </div>

            <div className="space-y-6">
              <TradePanel
                symbol={token.symbol}
                price={displayPrice}
                isCrashed={isCrashed}
                ipoEndsAt={token.ipoEndsAt}
                ipoPrice={token.ipoPrice}
              />
              <OrderBook />
              <TokenDistribution symbol={token.symbol} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
