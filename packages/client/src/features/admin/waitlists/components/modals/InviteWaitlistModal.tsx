import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { X } from "lucide-react";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

interface InviteWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  entry: WaitlistEntry;
  onSuccess: () => void;
}

export function InviteWaitlistModal({
  open,
  onClose,
  entry,
  onSuccess,
}: InviteWaitlistModalProps) {
  const toast = useToastActions();
  const inviteEntry = trpc.admin.waitlists.invite.useMutation();

  const [reason, setReason] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    try {
      await inviteEntry.mutateAsync({
        id: entry.id,
        reason: reason.trim() || undefined,
      });

      toast.success("Waitlist entry invited successfully");
      setReason("");
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to invite waitlist entry");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Invite Waitlist Entry</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {entry.email
            ? "This will send an invitation email to the applicant with their access token and Discord invite link."
            : "This will accept the applicant (no email on file — no invitation email will be sent)."}
        </p>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="invite-reason">Reason (Optional)</FieldLabel>
            <textarea
              id="invite-reason"
              placeholder="Enter reason for manual invitation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
            />
          </Field>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={onClose}
              disabled={inviteEntry.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 cursor-pointer"
              onClick={handleSubmit}
              disabled={inviteEntry.isPending}
            >
              {inviteEntry.isPending
                ? "Sending..."
                : entry.email
                  ? "Send Invitation"
                  : "Accept Entry"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
