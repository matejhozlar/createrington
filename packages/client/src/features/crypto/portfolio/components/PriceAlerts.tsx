import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export function PriceAlerts() {
  const { user } = useAuth();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const { data: alerts, isLoading } = trpc.user.crypto.alertList.useQuery(
    undefined,
    { enabled: !!user },
  );

  const createMutation = trpc.user.crypto.alertCreate.useMutation({
    onSuccess: () => {
      toast.success("Price alert created");
      utils.user.crypto.alertList.invalidate();
      setSymbol("");
      setTargetPrice("");
      setDirection("above");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.user.crypto.alertDelete.useMutation({
    onSuccess: () => {
      toast.success("Price alert deleted");
      utils.user.crypto.alertList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    const trimmedSymbol = symbol.trim();
    if (!trimmedSymbol) {
      toast.error("Enter a token symbol");
      return;
    }

    const price = Number(targetPrice);
    if (!targetPrice || isNaN(price) || price <= 0) {
      toast.error("Enter a valid positive price");
      return;
    }

    createMutation.mutate({
      symbol: trimmedSymbol.toUpperCase(),
      targetPrice: targetPrice,
      direction,
    });
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Sign in to manage price alerts
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" />
          Price Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Alert Form */}
        <div className="space-y-3 rounded-xl border bg-card/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Symbol
              </label>
              <Input
                placeholder="e.g. DOGE"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Target Price
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="pl-7 font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Direction
              </label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "above" | "below")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">
                    <span className="flex items-center gap-1">
                      <ArrowUp className="size-3 text-emerald-500" />
                      Above
                    </span>
                  </SelectItem>
                  <SelectItem value="below">
                    <span className="flex items-center gap-1">
                      <ArrowDown className="size-3 text-red-500" />
                      Below
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="shrink-0"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : !alerts || alerts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No price alerts set
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{alert.tokenSymbol}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      alert.direction === "above"
                        ? "text-emerald-400"
                        : "text-red-400",
                    )}
                  >
                    {alert.direction === "above" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )}
                    {alert.direction === "above" ? "Above" : "Below"}
                  </span>
                  <span className="font-mono tabular-nums text-sm">
                    ${Number(alert.targetPrice).toFixed(4)}
                  </span>
                  {alert.currentPrice !== undefined && (
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">
                      (now: ${Number(alert.currentPrice).toFixed(4)})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-red-500"
                  onClick={() => deleteMutation.mutate({ alertId: alert.id })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
