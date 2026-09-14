import { formatMoney } from "@/lib/format";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorName: string;
  rewardAmount: number;
  capReached: boolean;
  onConfirm: () => Promise<unknown>;
}

function rewardSentence(
  authorName: string,
  rewardAmount: number,
  capReached: boolean,
): string {
  if (capReached) return "The weekly cap is reached, so no reward is paid.";
  if (rewardAmount > 0) {
    return `${formatMoney(rewardAmount)} is paid to ${authorName}.`;
  }
  return "No reward is paid.";
}

export function ApproveDialog({
  open,
  onOpenChange,
  authorName,
  rewardAmount,
  capReached,
  onConfirm,
}: ApproveDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Approve this screenshot?"
      description={`The screenshot by ${authorName} is published on the website and announced in the gallery channel. ${rewardSentence(authorName, rewardAmount, capReached)}`}
      confirmLabel="Approve and publish"
      variant="success"
      onConfirm={onConfirm}
    />
  );
}
