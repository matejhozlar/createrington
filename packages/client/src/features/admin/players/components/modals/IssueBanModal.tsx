import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { AdminActionModal } from "./AdminActionModal";

interface IssueBanModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerUsername: string;
  onSuccess: () => void;
}

type BanType = "temporary" | "permanent";

export function IssueBanModal({
  open,
  onClose,
  playerId,
  playerUsername,
  onSuccess,
}: IssueBanModalProps) {
  const toast = useToastActions();
  const issueTemporaryBan = trpc.admin.players.bans.issueTemporary.useMutation({
    onError: () => toast.error("Failed to issue ban"),
  });
  const issuePermanentBan = trpc.admin.players.bans.issuePermanent.useMutation({
    onError: () => toast.error("Failed to issue ban"),
  });

  const [banType, setBanType] = useState<BanType>("temporary");
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState<number>(7);
  const [showPermanentConfirm, setShowPermanentConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleClose = () => {
    setReason("");
    setDurationDays(7);
    setBanType("temporary");
    setConfirmText("");
    setShowPermanentConfirm(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    if (banType === "permanent") {
      setShowPermanentConfirm(true);
      return;
    }

    await executeBan().catch(() => undefined);
  };

  const loading = issueTemporaryBan.isPending || issuePermanentBan.isPending;

  const executeBan = async () => {
    if (banType === "temporary") {
      await issueTemporaryBan.mutateAsync({
        id: playerId,
        reason: reason.trim(),
        durationDays,
      });
      toast.success(`Player banned for ${durationDays} days`);
    } else {
      await issuePermanentBan.mutateAsync({
        id: playerId,
        reason: reason.trim(),
      });
      toast.success("Player permanently banned and deleted");
    }

    setReason("");
    setDurationDays(7);
    setBanType("temporary");
    setConfirmText("");

    onSuccess();
    onClose();
  };

  return (
    <>
      <AdminActionModal
        open={open}
        onClose={handleClose}
        title="Issue Ban"
        onConfirm={handleSubmit}
        confirmLabel="Issue Ban"
        loading={loading}
        disabled={!reason.trim()}
        destructive={banType === "permanent"}
        asForm
      >
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Player:</span>{" "}
            <span className="font-medium">{playerUsername}</span>
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="ban-type">Ban Type</FieldLabel>
          <Select
            value={banType}
            onValueChange={(value) => setBanType(value as BanType)}
          >
            <SelectTrigger id="ban-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="permanent">
                Permanent (Deletes Player)
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {banType === "temporary" && (
          <Field>
            <FieldLabel htmlFor="duration">Duration (Days)</FieldLabel>
            <Select
              value={durationDays.toString()}
              onValueChange={(value) => setDurationDays(parseInt(value))}
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {banType === "permanent" && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="size-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  Warning: Permanent Ban
                </p>
                <p className="text-xs text-muted-foreground">
                  This will permanently delete all player data including
                  balance, sessions, tickets, and strikes. This action cannot be
                  undone.
                </p>
              </div>
            </div>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="ban-reason">Reason</FieldLabel>
          <textarea
            id="ban-reason"
            placeholder="Enter reason for ban..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={4}
            required
          />
        </Field>
      </AdminActionModal>

      <ConfirmDialog
        open={showPermanentConfirm}
        onOpenChange={(isOpen) => {
          setShowPermanentConfirm(isOpen);
          if (!isOpen) setConfirmText("");
        }}
        title={<span className="text-destructive">Confirm Permanent Ban</span>}
        description={
          <>
            This will permanently ban and DELETE all data for{" "}
            <span className="font-semibold">{playerUsername}</span>. This action
            cannot be undone. Type{" "}
            <span className="font-semibold">PERMANENTLY BAN</span> to confirm.
          </>
        }
        confirmLabel="Confirm Permanent Ban"
        variant="destructive"
        confirmDisabled={confirmText !== "PERMANENTLY BAN"}
        onConfirm={executeBan}
      >
        <Field>
          <Input
            type="text"
            placeholder="Type PERMANENTLY BAN to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}
