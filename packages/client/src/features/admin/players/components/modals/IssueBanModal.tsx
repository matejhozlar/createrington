import { BAN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
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
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import type { BanType } from "@createrington/shared/db";
import { pluralize } from "@/lib/format";

interface IssueBanModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerUsername: string;
}

const BAN_TYPE_OPTIONS: { value: BanType; label: string }[] = [
  { value: "temporary", label: "Temporary" },
  { value: "permanent", label: "Permanent (Deletes Player)" },
];

const DURATION_DAYS = [1, 3, 7, 14, 30, 60, 90];

const EMPTY_DRAFT: {
  banType: BanType;
  reason: string;
  durationDays: number;
  confirmingPermanent: boolean;
} = {
  banType: "temporary",
  reason: "",
  durationDays: 7,
  confirmingPermanent: false,
};

const invalidatePlayers = () =>
  void queryClient.invalidateQueries(trpc.admin.players.pathFilter());

export function IssueBanModal({
  open,
  onClose,
  playerId,
  playerUsername,
}: IssueBanModalProps) {
  const toast = useToastActions();
  const issueTemporaryBan = useMutation(
    trpc.admin.players.bans.issueTemporary.mutationOptions(
      useMutationToast({
        error: (err) => ({
          title: "Failed to issue ban",
          description: err.message,
        }),
        onSuccess: invalidatePlayers,
      }),
    ),
  );
  const issuePermanentBan = useMutation(
    trpc.admin.players.bans.issuePermanent.mutationOptions(
      useMutationToast({
        error: (err) => ({
          title: "Failed to issue ban",
          description: err.message,
        }),
        onSuccess: invalidatePlayers,
      }),
    ),
  );

  const [draft, update] = useDialogDraft(open, EMPTY_DRAFT);
  const { banType, reason, durationDays } = draft;

  const handleSubmit = async () => {
    if (banType === "permanent") {
      update({ confirmingPermanent: true });
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

    onClose();
  };

  return (
    <>
      <FormDialog
        open={open}
        onClose={onClose}
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
            onValueChange={(value) => update({ banType: value as BanType })}
          >
            <SelectTrigger id="ban-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BAN_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {banType === "temporary" && (
          <Field>
            <FieldLabel htmlFor="duration">Duration (Days)</FieldLabel>
            <Select
              value={durationDays.toString()}
              onValueChange={(value) =>
                update({ durationDays: parseInt(value) })
              }
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_DAYS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {pluralize(days, "Day")}
                  </SelectItem>
                ))}
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
          <Textarea
            id="ban-reason"
            placeholder="Enter reason for ban..."
            value={reason}
            onChange={(e) => update({ reason: e.target.value })}
            maxLength={BAN_REASON_MAX_LENGTH}
            rows={4}
            required
          />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={draft.confirmingPermanent}
        onOpenChange={(confirmingPermanent) => update({ confirmingPermanent })}
        title={<span className="text-destructive">Confirm Permanent Ban</span>}
        description={
          <>
            This will permanently ban and DELETE all data for{" "}
            <span className="font-semibold">{playerUsername}</span>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Confirm Permanent Ban"
        variant="destructive"
        confirmToken="PERMANENTLY BAN"
        onConfirm={executeBan}
      />
    </>
  );
}
