import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToastActions } from "@/hooks/use-toast";
import { Minus, Plus } from "lucide-react";

interface BoostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packId: number;
  packName: string;
  boostUnitPrice: number;
}

export function BoostDialog({
  open,
  onOpenChange,
  packId,
  packName,
  boostUnitPrice,
}: BoostDialogProps) {
  const { user } = useAuth();
  const toast = useToastActions();
  const [units, setUnits] = useState(1);
  const utils = trpc.useUtils();

  const { data: balanceData } = trpc.user.crypto.balance.useQuery(undefined, {
    enabled: !!user && open,
  });

  const balance = Number(balanceData?.balance ?? 0);
  const totalCost = units * boostUnitPrice;
  const canAfford = balance >= totalCost;

  const boostMutation = trpc.user.structurePacks.boost.useMutation({
    onSuccess: () => {
      toast.success(
        `Boosted "${packName}" with ${units} unit${units > 1 ? "s" : ""}`,
      );
      utils.user.structurePacks.pool.invalidate();
      utils.user.structurePacks.myBoosts.invalidate();
      utils.user.crypto.balance.invalidate();
      onOpenChange(false);
      setUnits(1);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConfirm = () => {
    if (!canAfford) {
      toast.error("Insufficient balance");
      return;
    }
    boostMutation.mutate({ packId, units });
  };

  const adjustUnits = (delta: number) => {
    setUnits((prev) => Math.max(1, Math.min(100, prev + delta)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Boost "{packName}"</DialogTitle>
          <DialogDescription>
            Purchase boost units to increase this pack's selection odds for the
            next rotation. All boosts reset when the rotation occurs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Boost Units</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => adjustUnits(-1)}
                disabled={units <= 1}
              >
                <Minus className="size-3.5" />
              </Button>
              <Input
                type="number"
                min={1}
                max={100}
                value={units}
                onChange={(e) => {
                  const val = Math.max(
                    1,
                    Math.min(100, Number(e.target.value) || 1),
                  );
                  setUnits(val);
                }}
                className="w-20 text-center font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => adjustUnits(1)}
                disabled={units >= 100}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price per unit</span>
              <span className="font-mono">
                ${boostUnitPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total cost</span>
              <span className="font-mono">${totalCost.toLocaleString()}</span>
            </div>
            <div className="border-t pt-1.5 flex justify-between">
              <span className="text-muted-foreground">Your balance</span>
              <span
                className={`font-mono ${canAfford ? "text-emerald-400" : "text-destructive"}`}
              >
                $
                {balance.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canAfford || boostMutation.isPending}
          >
            {boostMutation.isPending ? "Boosting..." : "Confirm Boost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
