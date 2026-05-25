import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Plus, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { AdminActionModal } from "./AdminActionModal";

interface BalanceAdjustModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  currentBalance: number;
  onSuccess: () => void;
}

export function BalanceAdjustModal({
  open,
  onClose,
  playerId,
  currentBalance,
  onSuccess,
}: BalanceAdjustModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const toast = useToastActions();
  const adjustBalance = trpc.admin.players.balance.adjust.useMutation();

  const handleSubmit = async () => {
    if (!amount || !reason) return;

    try {
      await adjustBalance.mutateAsync({
        id: playerId,
        amount: Number(amount),
        reason,
      });

      toast.success("Balance adjusted");
      setAmount("");
      setReason("");
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to adjust balance");
    }
  };

  return (
    <AdminActionModal
      open={open}
      onClose={onClose}
      title="Adjust Balance"
      onConfirm={handleSubmit}
      confirmLabel="Confirm"
      loadingLabel="Adjusting..."
      loading={adjustBalance.isPending}
      disabled={!amount || !reason}
    >
      <Field>
        <FieldLabel htmlFor="balance-amount">Amount</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="balance-amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setAmount((prev) =>
                prev.startsWith("-") ? prev.slice(1) : `-${prev}`,
              )
            }
          >
            {amount.startsWith("-") ? (
              <Plus className="size-4" />
            ) : (
              <Minus className="size-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Current balance: ${currentBalance.toLocaleString()}
        </p>
      </Field>

      <Field>
        <FieldLabel htmlFor="balance-reason">Reason</FieldLabel>
        <Input
          id="balance-reason"
          type="text"
          placeholder="Enter reason for adjustment"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
    </AdminActionModal>
  );
}
