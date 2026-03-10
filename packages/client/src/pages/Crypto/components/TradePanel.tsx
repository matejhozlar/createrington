import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToastActions } from "@/hooks/use-toast";
import { Clock, Rocket, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCountdown } from "./format";

type OrderMode = "market" | "limit" | "stop_loss" | "take_profit";
type TradeTab = "buy" | "sell";

interface TradePanelProps {
  symbol: string;
  price: string;
  isCrashed: boolean;
  ipoEndsAt?: string | null;
  ipoPrice?: string | null;
}

const ORDER_MODE_LABELS: Record<OrderMode, string> = {
  market: "Market",
  limit: "Limit",
  stop_loss: "Stop-Loss",
  take_profit: "Take-Profit",
};

export function TradePanel({ symbol, price, isCrashed, ipoEndsAt, ipoPrice }: TradePanelProps) {
  const { user } = useAuth();
  const toast = useToastActions();
  const [tab, setTab] = useState<TradeTab>("buy");
  const [orderMode, setOrderMode] = useState<OrderMode>("market");
  const [amount, setAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [ipoCountdown, setIpoCountdown] = useState("");

  const isIpo = !!ipoEndsAt && new Date(ipoEndsAt) > new Date();

  const { data: allocation } = trpc.user.crypto.ipoAllocation.useQuery(
    { symbol },
    { enabled: isIpo && !!user, refetchInterval: 10_000 },
  );

  useEffect(() => {
    if (!isIpo || !ipoEndsAt) return;

    const update = () => {
      const remaining = new Date(ipoEndsAt).getTime() - Date.now();
      setIpoCountdown(formatCountdown(remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isIpo, ipoEndsAt]);

  const utils = trpc.useUtils();

  const invalidateAll = () => {
    utils.user.crypto.portfolio.invalidate();
    utils.user.crypto.listOrders.invalidate();
    utils.public.crypto.list.invalidate();
    utils.public.crypto.get.invalidate({ symbol });
  };

  const showAchievementToasts = (newAchievements?: string[]) => {
    if (newAchievements && newAchievements.length > 0) {
      for (const name of newAchievements) {
        toast.success(`Achievement Unlocked: ${name}`);
      }
    }
  };

  const buyMutation = trpc.user.crypto.buy.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Bought ${data.amount} ${data.symbol} at $${Number(data.priceAtExecution).toFixed(4)}`,
      );
      showAchievementToasts(data.newAchievements);
      setAmount("");
      invalidateAll();
    },
    onError: (err) => toast.error(err.message),
  });

  const sellMutation = trpc.user.crypto.sell.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sold ${data.amount} ${data.symbol} at $${Number(data.priceAtExecution).toFixed(4)}`,
      );
      showAchievementToasts(data.newAchievements);
      setAmount("");
      invalidateAll();
    },
    onError: (err) => toast.error(err.message),
  });

  const placeOrderMutation = trpc.user.crypto.placeOrder.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${ORDER_MODE_LABELS[orderMode]} order placed: ${data.amount} ${data.symbol} @ $${Number(data.targetPrice).toFixed(4)}`,
      );
      setAmount("");
      setTargetPrice("");
      invalidateAll();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleTrade = () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (orderMode === "market") {
      if (tab === "buy") {
        buyMutation.mutate({ symbol, amount: amountNum });
      } else {
        sellMutation.mutate({ symbol, amount: amountNum });
      }
    } else {
      if (!targetPrice || Number(targetPrice) <= 0) {
        toast.error("Enter a valid target price");
        return;
      }

      let type: "limit_buy" | "limit_sell" | "stop_loss" | "take_profit";
      if (orderMode === "limit") {
        type = tab === "buy" ? "limit_buy" : "limit_sell";
      } else {
        type = orderMode;
      }

      placeOrderMutation.mutate({
        symbol,
        type,
        amount: amountNum,
        targetPrice,
      });
    }
  };

  const isPending =
    buyMutation.isPending ||
    sellMutation.isPending ||
    placeOrderMutation.isPending;
  const numPrice = isIpo ? Number(ipoPrice) : Number(price);
  const amountNum = parseInt(amount) || 0;
  const effectivePrice =
    isIpo || orderMode === "market" ? numPrice : Number(targetPrice) || 0;
  const estimatedCost = effectivePrice * amountNum;

  const showBuySellTabs = orderMode === "market" || orderMode === "limit";

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Sign in to trade
        </CardContent>
      </Card>
    );
  }

  // IPO-specific trade panel
  if (isIpo) {
    const remainingAllocation = allocation ? Number(allocation.remaining) : null;

    return (
      <Card className="border-primary/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-emerald-400" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="size-4 text-primary" />
              IPO: Buy {symbol}
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="font-mono tabular-nums">{ipoCountdown}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fixed price display */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IPO Price (fixed)</span>
              <span className="font-mono font-semibold text-primary tabular-nums">
                ${numPrice.toFixed(numPrice < 0.01 ? 6 : numPrice < 1 ? 4 : 2)}
              </span>
            </div>
            {remainingAllocation !== null && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Your remaining allocation</span>
                <span className="font-mono font-medium tabular-nums">
                  {remainingAllocation.toLocaleString()} tokens
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Amount
            </label>
            <Input
              type="number"
              placeholder={remainingAllocation !== null ? `Max ${remainingAllocation.toLocaleString()}` : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={remainingAllocation ?? undefined}
              className="font-mono mt-1.5"
            />
          </div>

          <div className="flex justify-between text-sm rounded-lg bg-muted/30 px-3 py-2.5">
            <span className="text-muted-foreground">Estimated Cost</span>
            <span className="font-mono font-medium tabular-nums">
              ${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Selling is disabled during the IPO phase. Normal trading begins when the IPO ends.
          </p>

          <Button
            className="w-full h-11"
            onClick={() => {
              if (amountNum <= 0) {
                toast.error("Enter a valid amount");
                return;
              }
              buyMutation.mutate({ symbol, amount: amountNum });
            }}
            disabled={isPending || amountNum <= 0 || (remainingAllocation !== null && amountNum > remainingAllocation)}
          >
            {isPending ? "Processing..." : `Buy ${symbol} (IPO)`}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden lg:sticky lg:top-5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Trade {symbol}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order mode selector */}
        <div className="grid grid-cols-4 gap-1 rounded-xl border bg-card p-1">
          {(Object.keys(ORDER_MODE_LABELS) as OrderMode[]).map((mode) => (
            <button
              key={mode}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-medium transition-all",
                orderMode === mode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
              onClick={() => {
                setOrderMode(mode);
                if (mode === "stop_loss" || mode === "take_profit") {
                  setTab("sell");
                }
              }}
            >
              {ORDER_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Buy/Sell toggle */}
        {showBuySellTabs && (
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border p-1">
            <button
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                tab === "buy"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab("buy")}
            >
              <ArrowUpRight className="size-4" />
              Buy
            </button>
            <button
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                tab === "sell"
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab("sell")}
            >
              <ArrowDownRight className="size-4" />
              Sell
            </button>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Amount
          </label>
          <Input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            className="font-mono mt-1.5 h-11"
          />
        </div>

        {/* Target price input */}
        {orderMode !== "market" && (
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {orderMode === "limit"
                ? tab === "buy"
                  ? "Buy at or below"
                  : "Sell at or above"
                : orderMode === "stop_loss"
                  ? "Sell if price drops to"
                  : "Sell if price rises to"}
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="any"
                placeholder={numPrice.toFixed(4)}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="pl-7 font-mono h-11"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground font-mono tabular-nums">
              Current: ${numPrice.toFixed(4)}
            </p>
          </div>
        )}

        {/* Estimated cost/revenue */}
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {tab === "buy" ? "Estimated Cost" : "Estimated Revenue"}
            </span>
            <span className="font-mono font-semibold tabular-nums">
              ${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>
        </div>

        {/* Submit button */}
        <Button
          className={cn(
            "w-full h-11 font-semibold",
            tab === "buy"
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white",
          )}
          onClick={handleTrade}
          disabled={isPending || isCrashed || amountNum <= 0}
        >
          {isPending
            ? "Processing..."
            : isCrashed
              ? "Token Crashed"
              : orderMode === "market"
                ? `${tab === "buy" ? "Buy" : "Sell"} ${symbol}`
                : `Place ${ORDER_MODE_LABELS[orderMode]} Order`}
        </Button>
      </CardContent>
    </Card>
  );
}
