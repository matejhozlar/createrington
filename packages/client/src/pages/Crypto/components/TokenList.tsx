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

  if (isLoading) {
    return <Loading mode="inline" size="large" text="Loading tokens..." className="py-12" />;
  }

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

      <div className="overflow-hidden rounded-xl border bg-card/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="w-[200px] text-[11px] font-medium uppercase tracking-wider">
                Token
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                Category
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                Price
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                24h
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                Supply
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                Status
              </TableHead>
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
                    "cursor-pointer transition-colors hover:bg-muted/30 border-b border-border/30 last:border-0",
                    isCrashed && "opacity-40",
                  )}
                  onClick={() => navigate(`/crypto/${token.symbol}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {isCrashed && (
                        <Skull className="size-4 text-red-500 shrink-0" />
                      )}
                      {!isCrashed && isIpo && (
                        <Rocket className="size-4 text-primary animate-pulse shrink-0" />
                      )}
                      {!isCrashed && !isIpo && hasEvent && (
                        <Zap className="size-4 text-yellow-400 animate-pulse shrink-0" />
                      )}
                      <div>
                        <p className="font-medium leading-tight">{token.name}</p>
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
                  <TableCell className="text-right font-mono tabular-nums font-medium">
                    ${formatPrice(displayPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCrashed ? (
                      <span className="text-muted-foreground">—</span>
                    ) : change24h !== 0 ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-sm font-mono tabular-nums font-medium",
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
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm font-mono">
                        0.00%
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground font-mono tabular-nums">
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
                        className="text-xs text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
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
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
