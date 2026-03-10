import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Skull } from "lucide-react";
import { TradePanel } from "./components/TradePanel";
import { PriceChart } from "./components/PriceChart";

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

  const { data: token, isLoading } = trpc.public.crypto.get.useQuery(
    { symbol: symbol ?? "" },
    { enabled: !!symbol, refetchInterval: 30_000 },
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

  const price = Number(token.price);
  const totalSupply = Number(token.totalSupply);
  const availableSupply = Number(token.availableSupply);
  const circulatingSupply = totalSupply - availableSupply;
  const marketCap = price * circulatingSupply;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => navigate("/crypto")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Market
      </Button>

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{token.name}</h1>
            <Badge
              variant="outline"
              className={cn("text-xs", CATEGORY_COLORS[token.category])}
            >
              {CATEGORY_LABELS[token.category]}
            </Badge>
            {token.isCrashed && (
              <Badge variant="destructive" className="gap-1">
                <Skull className="h-3 w-3" />
                Crashed
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

        <div className="text-right">
          <p className="text-3xl font-bold font-mono">
            ${formatPrice(token.price)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <PriceChart symbol={token.symbol} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Token Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Market Cap</dt>
                  <dd className="font-mono font-medium">
                    ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Circulating Supply</dt>
                  <dd className="font-mono font-medium">
                    {circulatingSupply.toLocaleString()} / {totalSupply >= 999999999 ? "∞" : totalSupply.toLocaleString()}
                  </dd>
                </div>
                {token.floorPrice && (
                  <div>
                    <dt className="text-muted-foreground">Floor Price</dt>
                    <dd className="font-mono font-medium">
                      ${Number(token.floorPrice).toFixed(2)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Listed</dt>
                  <dd className="font-medium">
                    {new Date(token.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div>
          <TradePanel
            symbol={token.symbol}
            price={token.price}
            isCrashed={token.isCrashed}
          />
        </div>
      </div>
    </div>
  );
}

function formatPrice(price: string): string {
  const num = Number(price);
  if (num === 0) return "0.00";
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
