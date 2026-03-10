import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToastActions } from "@/hooks/use-toast";
import { Clock, Rocket } from "lucide-react";

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

/**
 * Trade panel for a single token — supports market, limit, stop-loss, and take-profit orders.
 *
 * When the token is in its IPO phase (`ipoEndsAt` is set and in the future) the panel switches
 * to IPO mode: only buy orders are allowed at the fixed `ipoPrice`, and a per-user allocation
 * cap is enforced. Normal order modes become available once the IPO ends.
 */
export function TradePanel({ symbol, price, isCrashed, ipoEndsAt, ipoPrice }: TradePanelProps) {
  const { user } = useAuth();
  const toast = useToastActions();
  const [tab, setTab] = useState<TradeTab>("buy");
  const [orderMode, setOrderMode] = useState<OrderMode>("market");
  const [amount, setAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [ipoCountdown, setIpoCountdown] = useState("");

  const isIpo = !!ipoEndsAt && new Date(ipoEndsAt) > new Date();

  // IPO allocation query
  const { data: allocation } = trpc.user.crypto.ipoAllocation.useQuery(
    { symbol },
    { enabled: isIpo && !!user, refetchInterval: 10_000 },
  );

  // IPO countdown timer
  useEffect(() => {
    if (!isIpo || !ipoEndsAt) return;

    const update = () => {
      const remaining = new Date(ipoEndsAt).getTime() - Date.now();
      if (remaining <= 0) {
        setIpoCountdown("Ended");
        return;
      }
      const totalSec = Math.floor(remaining / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      if (hours > 0) setIpoCountdown(`${hours}h ${minutes}m ${seconds}s`);
      else if (minutes > 0) setIpoCountdown(`${minutes}m ${seconds}s`);
      else setIpoCountdown(`${seconds}s`);
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

  // For non-market orders, hide the buy/sell tabs for stop_loss and take_profit (always sell)
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
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-amber-400" />
              IPO: Buy {symbol}
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-mono">{ipoCountdown}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fixed price display */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IPO Price (fixed)</span>
              <span className="font-mono font-medium text-amber-400">
                ${numPrice.toFixed(numPrice < 0.01 ? 6 : numPrice < 1 ? 4 : 2)}
              </span>
            </div>
            {remainingAllocation !== null && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Your remaining allocation</span>
                <span className="font-mono font-medium">
                  {remainingAllocation.toLocaleString()} tokens
                </span>
              </div>
            )}
          </div>

          {/* Amount input */}
          <div>
            <label className="text-sm text-muted-foreground">Amount</label>
            <Input
              type="number"
              placeholder={remainingAllocation !== null ? `Max ${remainingAllocation.toLocaleString()}` : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              max={remainingAllocation ?? undefined}
              className="font-mono"
            />
          </div>

          {/* Estimated cost */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated Cost</span>
            <span className="font-mono">
              ${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Selling is disabled during the IPO phase. Normal trading begins when the IPO ends.
          </p>

          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium"
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Trade {symbol}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order mode selector */}
        <div className="grid grid-cols-4 gap-1 rounded-lg border p-1">
          {(Object.keys(ORDER_MODE_LABELS) as OrderMode[]).map((mode) => (
            <button
              key={mode}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                orderMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setOrderMode(mode);
                // Stop-loss and take-profit are always sell orders
                if (mode === "stop_loss" || mode === "take_profit") {
                  setTab("sell");
                }
              }}
            >
              {ORDER_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Buy/Sell toggle (only for market and limit) */}
        {showBuySellTabs && (
          <div className="flex rounded-lg border p-1">
            <button
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "buy"
                  ? "bg-emerald-500 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab("buy")}
            >
              Buy
            </button>
            <button
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "sell"
                  ? "bg-red-500 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab("sell")}
            >
              Sell
            </button>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="text-sm text-muted-foreground">Amount</label>
          <Input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            className="font-mono"
          />
        </div>

        {/* Target price input (for non-market orders) */}
        {orderMode !== "market" && (
          <div>
            <label className="text-sm text-muted-foreground">
              {orderMode === "limit"
                ? tab === "buy"
                  ? "Buy at or below"
                  : "Sell at or above"
                : orderMode === "stop_loss"
                  ? "Sell if price drops to"
                  : "Sell if price rises to"}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="any"
                placeholder={numPrice.toFixed(4)}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="pl-7 font-mono"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Current: ${numPrice.toFixed(4)}
            </p>
          </div>
        )}

        {/* Estimated cost/revenue */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {tab === "buy" ? "Estimated Cost" : "Estimated Revenue"}
          </span>
          <span className="font-mono">
            ${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        </div>

        {/* Submit button */}
        <Button
          className="w-full"
          variant={tab === "buy" ? "default" : "destructive"}
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
