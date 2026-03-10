import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";
import { Loading } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Skull, Rocket } from "lucide-react";
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
      <div className="px-5 md:px-8 pt-6 pb-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2"
            onClick={() => navigate("/crypto")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Market
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-semibold">{token.name}</h1>
                <Badge
                  variant="outline"
                  className={cn("text-xs", CATEGORY_COLORS[token.category])}
                >
                  {CATEGORY_LABELS[token.category]}
                </Badge>
                {isCrashed && (
                  <Badge variant="destructive" className="gap-1">
                    <Skull className="h-3 w-3" />
                    Crashed
                  </Badge>
                )}
                {isIpo && (
                  <Badge
                    variant="outline"
                    className="gap-1 text-primary border-primary/30 bg-primary/10"
                  >
                    <Rocket className="h-3 w-3" />
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

            <p className="text-3xl font-semibold font-mono shrink-0">
              ${formatPrice(displayPrice)}
            </p>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Market Cap </span>
              <span className="font-mono font-medium">
                ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Circulating </span>
              <span className="font-mono font-medium">
                {circulatingSupply.toLocaleString()} / {totalSupply >= 999999999 ? "∞" : totalSupply.toLocaleString()}
              </span>
            </div>
            {token.floorPrice && (
              <div>
                <span className="text-muted-foreground">Floor </span>
                <span className="font-mono font-medium">
                  ${Number(token.floorPrice).toFixed(2)}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Listed </span>
              <span className="font-medium">
                {new Date(token.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8">
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
