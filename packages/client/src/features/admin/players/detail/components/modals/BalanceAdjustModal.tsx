import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { X, Plus, Minus } from "lucide-react";
import type { AdjustPlayerBalanceResponse } from "@createrington/shared/api";

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
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!amount || !reason) return;

    try {
      setLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(
        `/api/admin/players/${playerId}/balance/adjust`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            reason,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AdjustPlayerBalanceResponse = await response.json();

      if (data.success) {
        alert(
          `Balance adjusted successfully! New balance: $${data.data.newBalance}`,
        );
        setAmount("");
        setReason("");
        onClose();
        onSuccess();
      }
    } catch (err) {
      console.error("Failed to adjust balance:", err);
      alert("Failed to adjust balance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Adjust Balance</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
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
                className="cursor-pointer"
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 cursor-pointer"
              onClick={handleSubmit}
              disabled={!amount || !reason || loading}
            >
              {loading ? "Adjusting..." : "Confirm"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
