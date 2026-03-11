import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useCryptoData } from "@/contexts/crypto-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, X } from "lucide-react";
import { formatPrice } from "../../format";
import { AnimatedNumber } from "../../components/AnimatedNumber";

export function Watchlist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPrice } = useCryptoData();
  const utils = trpc.useUtils();

  const { data: watchlist, isLoading } =
    trpc.user.crypto.watchlistList.useQuery(undefined, {
      enabled: !!user,
      refetchInterval: 30_000,
    });

  const removeMutation = trpc.user.crypto.watchlistRemove.useMutation({
    onSuccess: () => {
      utils.user.crypto.watchlistList.invalidate();
    },
  });

  if (!user) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="size-3.5 text-muted-foreground" />
            Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sign in to use watchlist
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Star className="size-3.5 text-muted-foreground" />
          Watchlist
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-muted/30"
              />
            ))}
          </div>
        ) : !watchlist || watchlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tokens in your watchlist
          </p>
        ) : (
          <div className="space-y-0.5">
            {watchlist.map((entry) => {
              const livePrice = getPrice(entry.symbol);
              const displayPrice = Number(livePrice?.price ?? entry.price);
              const change24h = livePrice?.change24h ?? 0;

              return (
                <div
                  key={entry.tokenId}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors hover:bg-muted/20"
                  onClick={() => navigate(`/crypto/${entry.symbol}`)}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium leading-tight block truncate">
                      {entry.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {entry.symbol}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <AnimatedNumber
                        value={displayPrice}
                        format={(n) => `$${formatPrice(n)}`}
                        className="text-sm font-mono tabular-nums font-medium block"
                      />
                      <span
                        className={cn(
                          "text-[10px] font-mono tabular-nums block text-right",
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

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground/50 hover:text-red-400"
                      disabled={removeMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMutation.mutate({ symbol: entry.symbol });
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
