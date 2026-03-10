import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToastActions } from "@/hooks/use-toast";

interface TradePanelProps {
  symbol: string;
  price: string;
  isCrashed: boolean;
}

export function TradePanel({ symbol, price, isCrashed }: TradePanelProps) {
  const { user } = useAuth();
  const toast = useToastActions();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  const utils = trpc.useUtils();

  const buyMutation = trpc.user.crypto.buy.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Bought ${data.amount} ${data.symbol} at $${Number(data.priceAtExecution).toFixed(4)}`,
      );
      setAmount("");
      utils.user.crypto.portfolio.invalidate();
      utils.public.crypto.list.invalidate();
      utils.public.crypto.get.invalidate({ symbol });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const sellMutation = trpc.user.crypto.sell.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sold ${data.amount} ${data.symbol} at $${Number(data.priceAtExecution).toFixed(4)}`,
      );
      setAmount("");
      utils.user.crypto.portfolio.invalidate();
      utils.public.crypto.list.invalidate();
      utils.public.crypto.get.invalidate({ symbol });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleTrade = () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (tab === "buy") {
      buyMutation.mutate({ symbol, amount: amountNum });
    } else {
      sellMutation.mutate({ symbol, amount: amountNum });
    }
  };

  const isPending = buyMutation.isPending || sellMutation.isPending;
  const numPrice = Number(price);
  const amountNum = parseInt(amount) || 0;
  const estimatedCost = numPrice * amountNum;

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Sign in to trade
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

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {tab === "buy" ? "Estimated Cost" : "Estimated Revenue"}
          </span>
          <span className="font-mono">
            ${estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        </div>

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
              : `${tab === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </Button>
      </CardContent>
    </Card>
  );
}
