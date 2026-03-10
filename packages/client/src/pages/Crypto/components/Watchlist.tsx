import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useCryptoData } from "@/contexts/crypto-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, X, TrendingUp, TrendingDown } from "lucide-react";
import { formatPrice } from "./format";

/** User's crypto watchlist with live price updates. */
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-yellow-500" />
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-yellow-500" />
          Watchlist
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : !watchlist || watchlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tokens in your watchlist
          </p>
        ) : (
          <div className="space-y-1">
            {watchlist.map((entry) => {
              const livePrice = getPrice(entry.symbol);
              const displayPrice = livePrice?.price ?? entry.price;
              const change24h = livePrice?.change24h ?? 0;

              return (
                <div
                  key={entry.tokenId}
                  className="flex items-center justify-between rounded-md px-2 py-2 cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/crypto/${entry.symbol}`)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {entry.symbol}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-mono">
                        ${formatPrice(displayPrice)}
                      </span>
                      {change24h !== 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-mono",
                            change24h > 0
                              ? "text-emerald-400"
                              : "text-red-400",
                          )}
                        >
                          {change24h > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
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

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      disabled={removeMutation.isPending}
                      onClick={(e) => {
                        // Prevent the parent row's navigate handler from triggering
                        e.stopPropagation();
                        removeMutation.mutate({ symbol: entry.symbol });
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
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
