import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

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
  const issueTemporaryBan =
    trpc.admin.players.bans.issueTemporary.useMutation();
  const issuePermanentBan =
    trpc.admin.players.bans.issuePermanent.useMutation();

  const [banType, setBanType] = useState<BanType>("temporary");
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState<number>(7);
  const [showPermanentConfirm, setShowPermanentConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    // Show confirmation for permanent bans
    if (banType === "permanent") {
      setShowPermanentConfirm(true);
      return;
    }

    await executeBan();
  };

  const loading = issueTemporaryBan.isPending || issuePermanentBan.isPending;

  const executeBan = async () => {
    try {
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

      // Reset form
      setReason("");
      setDurationDays(7);
      setBanType("temporary");
      setConfirmText("");
      setShowPermanentConfirm(false);

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to issue ban:", err);
      toast.error("Failed to issue ban");
    }
  };

  const handleConfirmPermanent = async () => {
    if (confirmText !== "PERMANENTLY BAN") {
      toast.error('You must type "PERMANENTLY BAN" to confirm');
      return;
    }

    await executeBan();
  };

  const handleCancelConfirm = () => {
    setShowPermanentConfirm(false);
    setConfirmText("");
  };

  const handleClose = () => {
    setReason("");
    setDurationDays(7);
    setBanType("temporary");
    setConfirmText("");
    setShowPermanentConfirm(false);
    onClose();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Issue Ban</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="cursor-pointer"
            >
              <X className="size-4 cursor-pointer" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  <SelectItem value="temporary">
                    Temporary
                  </SelectItem>
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
                    <SelectItem value="1">
                      1 Day
                    </SelectItem>
                    <SelectItem value="3">
                      3 Days
                    </SelectItem>
                    <SelectItem value="7">
                      7 Days
                    </SelectItem>
                    <SelectItem value="14">
                      14 Days
                    </SelectItem>
                    <SelectItem value="30">
                      30 Days
                    </SelectItem>
                    <SelectItem value="60">
                      60 Days
                    </SelectItem>
                    <SelectItem value="90">
                      90 Days
                    </SelectItem>
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
                      balance, sessions, tickets, and strikes. This action
                      cannot be undone.
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

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={banType === "permanent" ? "destructive" : "default"}
                className="flex-1 cursor-pointer"
                disabled={!reason.trim() || loading}
              >
                {loading ? "Issuing..." : "Issue Ban"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Permanent Ban Confirmation Dialog */}
      <AlertDialog
        open={showPermanentConfirm}
        onOpenChange={setShowPermanentConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Confirm Permanent Ban
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently ban and DELETE all data for{" "}
              <span className="font-semibold">{playerUsername}</span>. This
              action cannot be undone. Type{" "}
              <span className="font-semibold">PERMANENTLY BAN</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Field>
            <Input
              type="text"
              placeholder="Type PERMANENTLY BAN to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelConfirm}
              className="cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={handleConfirmPermanent}
              disabled={confirmText !== "PERMANENTLY BAN" || loading}
            >
              {loading ? "Banning..." : "Confirm Permanent Ban"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
