import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCryptoData } from "@/contexts/crypto-data";
import { Loading } from "@/components/loading-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skull, TrendingUp, TrendingDown, Zap, Rocket } from "lucide-react";
import {
  useActiveEventTokenIds,
  useHasMarketWideEvent,
} from "./useActiveEvents";
import { formatPrice, formatSupply } from "./format";

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

  if (isLoading) {
    return <Loading mode="inline" size="large" text="Loading tokens..." className="py-12" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(
          [
            ["all", "All"],
            ["stable", "Stable"],
            ["blue_chip", "Blue Chip"],
            ["memecoin", "Memecoin"],
            ["seasonal", "Seasonal"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Token</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">24h Change</TableHead>
              <TableHead className="text-right">Supply</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens?.map((token) => {
              const livePrice = getPrice(token.symbol);
              const displayPrice = livePrice?.price ?? token.price;
              const isCrashed = livePrice?.isCrashed ?? token.isCrashed;
              const availableSupply = livePrice?.availableSupply ?? token.availableSupply;
              const change24h = livePrice?.change24h ?? 0;
              const isIpo = !!token.ipoEndsAt && new Date(token.ipoEndsAt) > new Date();
              const hasEvent =
                hasMarketWideEvent ||
                eventTokenIds.has(token.id);

              return (
                <TableRow
                  key={token.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    isCrashed && "opacity-50",
                  )}
                  onClick={() => navigate(`/crypto/${token.symbol}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isCrashed && (
                        <Skull className="h-4 w-4 text-red-500" />
                      )}
                      {!isCrashed && isIpo && (
                        <Rocket className="h-4 w-4 text-primary animate-pulse" />
                      )}
                      {!isCrashed && !isIpo && hasEvent && (
                        <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
                      )}
                      <div>
                        <p className="font-medium">{token.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {token.symbol}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        CATEGORY_COLORS[token.category],
                      )}
                    >
                      {CATEGORY_LABELS[token.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${formatPrice(displayPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {isCrashed ? (
                      <span className="text-muted-foreground">—</span>
                    ) : change24h !== 0 ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-sm",
                          change24h > 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {change24h > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {change24h > 0 ? "+" : ""}
                        {change24h.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">0.00%</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground font-mono">
                    {formatSupply(availableSupply, token.totalSupply)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCrashed ? (
                      <Badge variant="destructive" className="text-xs">
                        Crashed
                      </Badge>
                    ) : isIpo ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-primary border-primary/30 bg-primary/10"
                      >
                        IPO
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-emerald-400 border-emerald-500/20"
                      >
                        Active
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {(!tokens || tokens.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No tokens found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
