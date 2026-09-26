import { useState } from "react";
import { Equal, Minus, Plus, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatMoney } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AdminActionModal } from "./AdminActionModal";

type Mode = "add" | "remove" | "set";

const MODES: {
  value: Mode;
  label: string;
  icon: LucideIcon;
  amountLabel: string;
  confirmLabel: (amount: string) => string;
  successMessage: (amount: string, player: string) => string;
}[] = [
  {
    value: "add",
    label: "Add",
    icon: Plus,
    amountLabel: "Amount to add",
    confirmLabel: (amount) => `Add ${amount}`,
    successMessage: (amount, player) => `Added ${amount} to ${player}`,
  },
  {
    value: "remove",
    label: "Remove",
    icon: Minus,
    amountLabel: "Amount to remove",
    confirmLabel: (amount) => `Remove ${amount}`,
    successMessage: (amount, player) => `Removed ${amount} from ${player}`,
  },
  {
    value: "set",
    label: "Set",
    icon: Equal,
    amountLabel: "New balance",
    confirmLabel: (amount) => `Set to ${amount}`,
    successMessage: (amount, player) => `Set ${player}'s balance to ${amount}`,
  },
];

const AMOUNT_PATTERN = /^\d{0,9}(\.\d{0,2})?$/;
const MAX_REASON_LENGTH = 500;

interface BalanceAdjustModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  currentBalance: number;
  onSuccess: () => void;
}

export function BalanceAdjustModal({
  open,
  onClose,
  playerId,
  playerName,
  currentBalance,
  onSuccess,
}: BalanceAdjustModalProps) {
  const [mode, setMode] = useState<Mode>("add");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");

  const utils = trpc.useUtils();
  const adjust = trpc.admin.players.balance.adjust.useMutation(
    useMutationToast({
      success: (_, variables) => {
        const config = MODES.find((m) => m.value === variables.mode)!;
        return config.successMessage(formatMoney(variables.amount), playerName);
      },
      onSuccess: () => {
        utils.admin.players.transactions.list.invalidate({ id: playerId });
        utils.admin.players.audit.list.invalidate();
        onClose();
        onSuccess();
      },
    }),
  );

  const config = MODES.find((m) => m.value === mode)!;
  const amount =
    amountInput === "" || amountInput === "." ? null : Number(amountInput);

  const newBalance =
    amount === null
      ? null
      : mode === "add"
        ? currentBalance + amount
        : mode === "remove"
          ? currentBalance - amount
          : amount;
  const delta = newBalance === null ? null : newBalance - currentBalance;

  const amountError =
    mode === "remove" && amount !== null && amount > currentBalance
      ? `${playerName} only has ${formatMoney(currentBalance)}`
      : null;
  const isNoop = delta !== null && Math.abs(delta) < 0.005;
  const canSubmit =
    amount !== null && !amountError && !isNoop && reason.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    adjust.mutate({ id: playerId, mode, amount, reason: reason.trim() });
  };

  return (
    <AdminActionModal
      open={open}
      onClose={onClose}
      title="Adjust Balance"
      description={
        <>
          Change <strong className="text-foreground">{playerName}</strong>'s
          balance. Every change is recorded in their transaction history and the
          audit log.
        </>
      }
      onConfirm={handleSubmit}
      confirmLabel={
        amount === null
          ? config.label
          : config.confirmLabel(formatMoney(amount))
      }
      loading={adjust.isPending}
      disabled={!canSubmit}
      asForm
    >
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="grid w-full grid-cols-3">
          {MODES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="cursor-pointer">
              <Icon className="size-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Field data-invalid={!!amountError}>
        <FieldLabel htmlFor="balance-amount">{config.amountLabel}</FieldLabel>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            $
          </span>
          <Input
            id="balance-amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={amountInput}
            aria-invalid={!!amountError}
            onChange={(e) => {
              const next = e.target.value.replace(/[,\s$]/g, "");
              if (AMOUNT_PATTERN.test(next)) setAmountInput(next);
            }}
            className="h-11 pl-7 font-mono text-lg tabular-nums md:text-lg"
          />
        </div>
        {amountError && <FieldError>{amountError}</FieldError>}
      </Field>

      <BalancePreview
        currentBalance={currentBalance}
        delta={delta}
        newBalance={newBalance}
        invalid={!!amountError}
      />

      <Field>
        <FieldLabel htmlFor="balance-reason">Reason</FieldLabel>
        <Input
          id="balance-reason"
          autoComplete="off"
          placeholder="e.g. Refund for items lost in a server crash"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          onChange={(e) => setReason(e.target.value)}
        />
        <FieldDescription className="text-xs">
          Shown as the transaction description.
        </FieldDescription>
      </Field>
    </AdminActionModal>
  );
}

function BalancePreview({
  currentBalance,
  delta,
  newBalance,
  invalid,
}: {
  currentBalance: number;
  delta: number | null;
  newBalance: number | null;
  invalid: boolean;
}) {
  const hasChange = delta !== null && !invalid;

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 font-mono text-sm tabular-nums">
      <div className="flex items-center justify-between">
        <span className="font-sans text-muted-foreground">Current balance</span>
        <span>{formatMoney(currentBalance)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-sans text-muted-foreground">Change</span>
        <span
          className={cn(
            !hasChange && "text-muted-foreground",
            hasChange && delta > 0 && "text-emerald-400",
            hasChange && delta < 0 && "text-destructive",
          )}
        >
          {hasChange
            ? `${delta < 0 ? "-" : "+"}${formatMoney(Math.abs(delta))}`
            : "–"}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
        <span className="font-sans">New balance</span>
        <span className={cn(!hasChange && "text-muted-foreground")}>
          {hasChange && newBalance !== null ? formatMoney(newBalance) : "–"}
        </span>
      </div>
    </div>
  );
}
