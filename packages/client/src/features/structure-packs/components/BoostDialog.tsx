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

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setUnits(1);
    onOpenChange(nextOpen);
  };

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
      utils.public.structurePacks.pool.invalidate();
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="border-white/10 bg-white/[0.03] text-white shadow-2xl shadow-black/40 backdrop-blur-2xl sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white">
            Boost &ldquo;{packName}&rdquo;
          </DialogTitle>
          <DialogDescription className="text-white/55">
            Purchase boost units to increase this dimension&apos;s selection
            odds for the next rotation. All boosts reset when the rotation
            occurs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.22em] text-white/45">
              Boost Units
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white disabled:opacity-40"
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
                className="w-20 border-white/15 bg-white/5 text-center font-mono text-white"
              />
              <Button
                variant="outline"
                size="icon"
                className="size-8 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white disabled:opacity-40"
                onClick={() => adjustUnits(1)}
                disabled={units >= 100}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/55">Price per unit</span>
              <span className="font-mono tabular-nums text-white/85">
                ${boostUnitPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-white">Total cost</span>
              <span className="font-mono tabular-nums text-white">
                ${totalCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1.5">
              <span className="text-white/55">Your balance</span>
              <span
                className={`font-mono tabular-nums ${
                  canAfford ? "text-[var(--blue-bright)]" : "text-destructive"
                }`}
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
          <Button
            variant="outline"
            className="border-white/15 bg-transparent text-white/75 hover:bg-white/5 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canAfford}
            loading={boostMutation.isPending}
            className="bg-[var(--blue)] text-white hover:bg-[var(--blue-bright)] disabled:opacity-50"
          >
            Confirm Boost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
