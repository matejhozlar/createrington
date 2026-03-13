import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToastActions } from "@/hooks/use-toast";
import { X, Clock } from "lucide-react";

const ORDER_TYPE_LABELS: Record<string, string> = {
  limit_buy: "Limit Buy",
  limit_sell: "Limit Sell",
  stop_loss: "Stop-Loss",
  take_profit: "Take-Profit",
};

const ORDER_TYPE_COLORS: Record<string, string> = {
  limit_buy: "text-emerald-400",
  limit_sell: "text-red-400",
  stop_loss: "text-amber-400",
  take_profit: "text-blue-400",
};

export function OrderBook() {
  const { user } = useAuth();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const { data: orders, isLoading } = trpc.user.crypto.listOrders.useQuery(
    undefined,
    { enabled: !!user },
  );

  const cancelMutation = trpc.user.crypto.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled");
      utils.user.crypto.balance.invalidate();
      utils.user.crypto.listOrders.invalidate();
      utils.user.crypto.portfolio.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!user || isLoading) return null;
  if (!orders || orders.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Pending Orders</CardTitle>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {orders.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map((order) => {
          const expiresAt = new Date(order.expiresAt);
          const hoursLeft = Math.max(
            0,
            (expiresAt.getTime() - now) / (1000 * 60 * 60),
          );

          return (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-xl border bg-card/50 p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      ORDER_TYPE_COLORS[order.type],
                    )}
                  >
                    {ORDER_TYPE_LABELS[order.type]}
                  </span>
                  <span className="text-sm font-mono">{order.tokenSymbol}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    {Number(order.amount).toLocaleString()} @ $
                    {Number(order.targetPrice).toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {hoursLeft < 1
                      ? `${Math.round(hoursLeft * 60)}m`
                      : `${Math.round(hoursLeft)}h`}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-red-400"
                onClick={() => cancelMutation.mutate({ orderId: order.id })}
                disabled={cancelMutation.isPending}
              >
                <X className="size-4" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
