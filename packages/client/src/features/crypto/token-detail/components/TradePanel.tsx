import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToastActions } from "@/hooks/use-toast";
import {
  Clock,
  Rocket,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
} from "lucide-react";
import { formatCountdown } from "../../format";

type OrderMode = "market" | "limit" | "stop_loss" | "take_profit";
type TradeTab = "buy" | "sell";

interface TradePanelProps {
  symbol: string;
  price: string;
  category: string;
  isCrashed: boolean;
  ipoEndsAt?: string | null;
  ipoPrice?: string | null;
}

const FEE_RATES: Record<string, number> = {
  stable: 0,
  blue_chip: 0.005,
  memecoin: 0.05,
  seasonal: 0.01,
};

const ORDER_MODE_LABELS: Record<OrderMode, string> = {
  market: "Market",
  limit: "Limit",
  stop_loss: "Stop-Loss",
  take_profit: "Take-Profit",
};

export function TradePanel({
  symbol,
  price,
  category,
  isCrashed,
  ipoEndsAt,
  ipoPrice,
}: TradePanelProps) {
  const { user } = useAuth();
  const toast = useToastActions();
  const [tab, setTab] = useState<TradeTab>("buy");
  const [orderMode /* , setOrderMode */] = useState<OrderMode>("market");
  const [amount, setAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [ipoCountdown, setIpoCountdown] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(
    null,
  );
  const [cooldownText, setCooldownText] = useState("");

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

  // Fetch server-side cooldown on mount (survives page refresh)
  const { data: cooldownData } = trpc.user.crypto.cooldown.useQuery(
    { symbol },
    { enabled: !!user && !isIpo },
  );

  // Countdown timer for active cooldown (merges mutation-set and query-fetched expiry)
  useEffect(() => {
    const expiresAt =
      cooldownExpiresAt ??
      (cooldownData?.expiresAt && cooldownData.expiresAt > Date.now()
        ? cooldownData.expiresAt
        : null);

    if (!expiresAt) return;

    const update = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setCooldownExpiresAt(null);
        setCooldownText("");
      } else {
        setCooldownText(formatCountdown(remaining));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => {
      clearInterval(interval);
      setCooldownText("");
    };
  }, [cooldownExpiresAt, cooldownData]);

  const { data: balanceData } = trpc.user.crypto.balance.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: portfolioData } = trpc.user.crypto.portfolio.useQuery(
    undefined,
    { enabled: !!user },
  );

  const userBalance = Number(balanceData?.balance ?? 0);
  const holding = portfolioData?.holdings.find((h) => h.symbol === symbol);
  const holdingAmount = Number(holding?.amount ?? 0);

  const utils = trpc.useUtils();

  const invalidateAll = () => {
    utils.user.crypto.balance.invalidate();
    utils.user.crypto.portfolio.invalidate();
    utils.user.crypto.listOrders.invalidate();
    utils.user.crypto.tradeHistory.invalidate();
    utils.public.crypto.list.invalidate();
    utils.public.crypto.get.invalidate({ symbol });
    utils.public.crypto.tokenDistribution.invalidate({ symbol });
    utils.user.crypto.ipoAllocation.invalidate({ symbol });
  };

  const buyMutation = trpc.user.crypto.buy.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Bought ${data.amount} ${data.symbol} at $${Number(data.priceAtExecution).toFixed(4)}`,
      );
      setAmount("");
      if (data.cooldownExpiresAt) setCooldownExpiresAt(data.cooldownExpiresAt);
      invalidateAll();
    },
    onError: (err) => toast.error(err.message),
  });

  const sellMutation = trpc.user.crypto.sell.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sold ${data.amount} ${data.symbol} at $${Number(data.priceAtExecution).toFixed(4)}`,
      );
      setAmount("");
      if (data.cooldownExpiresAt) setCooldownExpiresAt(data.cooldownExpiresAt);
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
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      toast.error("Enter a valid whole number");
      return;
    }
    const amountNum = parsed;

    if (orderMode === "market") {
      setShowConfirm(true);
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

  const executeMarketTrade = () => {
    const amountNum = Math.floor(Number(amount)) || 0;
    if (tab === "buy") {
      buyMutation.mutate({ symbol, amount: amountNum });
    } else {
      sellMutation.mutate({ symbol, amount: amountNum });
    }
  };

  const isPending =
    buyMutation.isPending ||
    sellMutation.isPending ||
    placeOrderMutation.isPending;
  const isOnCooldown = orderMode === "market" && !!cooldownText;
  const numPrice = isIpo ? Number(ipoPrice) : Number(price);
  const amountNum = Math.floor(Number(amount)) || 0;
  const effectivePrice =
    isIpo || orderMode === "market" ? numPrice : Number(targetPrice) || 0;
  const feeRate = FEE_RATES[category] ?? 0.05;
  const estimatedCost =
    tab === "buy"
      ? effectivePrice * amountNum * (1 + feeRate)
      : effectivePrice * amountNum * (1 - feeRate);

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
    const remainingAllocation = allocation
      ? Number(allocation.remaining)
      : null;

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
                <span className="text-muted-foreground">
                  Your remaining allocation
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {remainingAllocation.toLocaleString()} tokens
                </span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Amount
            </Label>
            <Input
              type="number"
              placeholder={
                remainingAllocation !== null
                  ? `Max ${remainingAllocation.toLocaleString()}`
                  : "0"
              }
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
              $
              {estimatedCost.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Selling is disabled during the IPO phase. Normal trading begins when
            the IPO ends.
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
            disabled={
              isPending ||
              amountNum <= 0 ||
              (remainingAllocation !== null && amountNum > remainingAllocation)
            }
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
        {/* Buy/Sell toggle */}
        {showBuySellTabs && (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "buy" | "sell")}
            className="gap-0"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-xl border bg-transparent p-1 h-auto">
              <TabsTrigger
                value="buy"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <ArrowUpRight className="size-4" />
                Buy
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold data-[state=active]:bg-destructive data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <ArrowDownRight className="size-4" />
                Sell
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Amount input */}
        <div>
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Amount
          </Label>
          <Input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            className="font-mono mt-1.5 h-11"
          />
          {/* Percentage quick-fill buttons */}
          {effectivePrice > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[25, 50, 75, 100].map((pct) => {
                const costPerToken = effectivePrice * (1 + feeRate);
                const max =
                  tab === "buy"
                    ? Math.floor(userBalance / costPerToken)
                    : holdingAmount;
                const qty = pct === 100 ? max : Math.floor((max * pct) / 100);
                return (
                  <button
                    key={pct}
                    type="button"
                    className="rounded-md border bg-muted/30 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    onClick={() => setAmount(String(Math.max(0, qty)))}
                  >
                    {pct === 100 ? "Max" : `${pct}%`}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Target price input */}
        {orderMode !== "market" && (
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {orderMode === "limit"
                ? tab === "buy"
                  ? "Buy at or below"
                  : "Sell at or above"
                : orderMode === "stop_loss"
                  ? "Sell if price drops to"
                  : "Sell if price rises to"}
            </Label>
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
              $
              {estimatedCost.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </span>
          </div>
        </div>

        {/* Cooldown indicator */}
        {cooldownText && orderMode === "market" && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-400">
            <Timer className="size-4 shrink-0" />
            <span>
              Trade again in{" "}
              <span className="font-mono font-semibold tabular-nums">
                {cooldownText}
              </span>
            </span>
          </div>
        )}

        {/* Submit button */}
        <Button
          variant={tab === "buy" ? "success" : "destructive"}
          className="w-full h-11"
          onClick={handleTrade}
          disabled={isPending || isCrashed || amountNum <= 0 || isOnCooldown}
        >
          {isPending
            ? "Processing..."
            : isCrashed
              ? "Token Crashed"
              : orderMode === "market"
                ? `${tab === "buy" ? "Buy" : "Sell"} ${symbol}`
                : `Place ${ORDER_MODE_LABELS[orderMode]} Order`}
        </Button>

        {/* Market order confirmation dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Confirm {tab === "buy" ? "Buy" : "Sell"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {tab === "buy" ? "Buy" : "Sell"}{" "}
                <span className="font-semibold text-foreground">
                  {amountNum.toLocaleString()} {symbol}
                </span>{" "}
                at ~$
                {numPrice.toFixed(
                  numPrice < 0.01 ? 6 : numPrice < 1 ? 4 : 2,
                )}{" "}
                for{" "}
                <span className="font-semibold text-foreground">
                  ~$
                  {estimatedCost.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
                {feeRate > 0
                  ? ` (incl. ${(feeRate * 100).toFixed(1)}% fee)`
                  : ""}
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={tab === "buy" ? "default" : "destructive"}
                className={cn(
                  tab === "buy" &&
                    "bg-emerald-500 hover:bg-emerald-600 text-white",
                )}
                onClick={executeMarketTrade}
              >
                {tab === "buy" ? "Buy" : "Sell"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
