import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
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
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { AdminActionModal } from "./AdminActionModal";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

interface EditPlayerModalProps {
  open: boolean;
  onClose: () => void;
  player: PlayerDetailed["player"];
  onSuccess: () => void;
}

export function EditPlayerModal({
  open,
  onClose,
  player,
  onSuccess,
}: EditPlayerModalProps) {
  const toast = useToastActions();
  const updatePlayer = trpc.admin.players.players.update.useMutation();

  const [minecraftUsername, setMinecraftUsername] = useState(
    player.minecraftUsername,
  );
  const [discordId, setDiscordId] = useState(player.discordId);
  const [reason, setReason] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState<{
    minecraftUsername?: string;
    discordId?: string;
    reason?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    const hasChanges =
      minecraftUsername !== player.minecraftUsername ||
      discordId !== player.discordId;

    if (!hasChanges) {
      newErrors.minecraftUsername = "No changes to save";
      setErrors(newErrors);
      return false;
    }

    if (minecraftUsername.trim().length === 0) {
      newErrors.minecraftUsername = "Minecraft username is required";
    } else if (minecraftUsername.trim().length < 3) {
      newErrors.minecraftUsername = "Username must be at least 3 characters";
    } else if (minecraftUsername.trim().length > 16) {
      newErrors.minecraftUsername = "Username must not exceed 16 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(minecraftUsername.trim())) {
      newErrors.minecraftUsername =
        "Username can only contain letters, numbers, and underscores";
    }

    if (discordId.trim().length === 0) {
      newErrors.discordId = "Discord ID is required";
    } else if (!/^\d{17,20}$/.test(discordId.trim())) {
      newErrors.discordId = "Discord ID must be 17-20 digits";
    }

    if (reason.trim().length === 0) {
      newErrors.reason = "Reason is required for player updates";
    } else if (reason.trim().length < 5) {
      newErrors.reason = "Reason must be at least 5 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReviewChanges = () => {
    if (validateForm()) {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      const input: {
        id: string;
        reason: string;
        minecraftUsername?: string;
        discordId?: string;
      } = {
        id: player.minecraftUuid,
        reason: reason.trim(),
      };

      if (minecraftUsername.trim() !== player.minecraftUsername) {
        input.minecraftUsername = minecraftUsername.trim();
      }
      if (discordId.trim() !== player.discordId) {
        input.discordId = discordId.trim();
      }

      if (!input.minecraftUsername && !input.discordId) {
        toast.error("No changes to save");
        return;
      }

      await updatePlayer.mutateAsync(input);

      toast.success("Player updated");
      setReason("");
      setShowConfirmDialog(false);
      onClose();
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update player",
      );
    }
  };

  const handleCancel = () => {
    setMinecraftUsername(player.minecraftUsername);
    setDiscordId(player.discordId);
    setReason("");
    setErrors({});
    onClose();
  };

  const getChangesSummary = () => {
    const changes: string[] = [];
    if (minecraftUsername !== player.minecraftUsername) {
      changes.push(
        `Username: ${player.minecraftUsername} → ${minecraftUsername}`,
      );
    }
    if (discordId !== player.discordId) {
      changes.push(`Discord ID: ${player.discordId} → ${discordId}`);
    }
    return changes;
  };

  return (
    <>
      <AdminActionModal
        open={open}
        onClose={handleCancel}
        title="Edit Player"
        description="Update player information. All changes require a reason and will be logged in the audit trail."
        onConfirm={handleReviewChanges}
        confirmLabel="Review Changes"
        loadingLabel="Saving..."
        loading={updatePlayer.isPending}
        contentClassName="sm:max-w-lg"
      >
        <Field>
          <FieldLabel htmlFor="edit-minecraft-username">
            Minecraft Username
          </FieldLabel>
          <Input
            id="edit-minecraft-username"
            type="text"
            placeholder="Enter Minecraft username"
            value={minecraftUsername}
            onChange={(e) => {
              setMinecraftUsername(e.target.value);
              if (errors.minecraftUsername) {
                setErrors({ ...errors, minecraftUsername: undefined });
              }
            }}
            aria-invalid={!!errors.minecraftUsername}
            disabled={updatePlayer.isPending}
          />
          <FieldDescription>
            3-16 characters, letters, numbers, and underscores only
          </FieldDescription>
          {errors.minecraftUsername && (
            <FieldError>{errors.minecraftUsername}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-discord-id">Discord ID</FieldLabel>
          <Input
            id="edit-discord-id"
            type="text"
            placeholder="Enter Discord ID"
            value={discordId}
            onChange={(e) => {
              setDiscordId(e.target.value);
              if (errors.discordId) {
                setErrors({ ...errors, discordId: undefined });
              }
            }}
            aria-invalid={!!errors.discordId}
            disabled={updatePlayer.isPending}
          />
          <FieldDescription>17-20 digit Discord user ID</FieldDescription>
          {errors.discordId && <FieldError>{errors.discordId}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-reason">Reason for Update</FieldLabel>
          <textarea
            id="edit-reason"
            placeholder="Explain why these changes are being made..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason) {
                setErrors({ ...errors, reason: undefined });
              }
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            rows={3}
            aria-invalid={!!errors.reason}
            disabled={updatePlayer.isPending}
          />
          <FieldDescription>
            Minimum 5 characters required for audit trail
          </FieldDescription>
          {errors.reason && <FieldError>{errors.reason}</FieldError>}
        </Field>

        {(minecraftUsername !== player.minecraftUsername ||
          discordId !== player.discordId) && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">
              Changes to be made:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {minecraftUsername !== player.minecraftUsername && (
                <li>
                  • Username: {player.minecraftUsername} → {minecraftUsername}
                </li>
              )}
              {discordId !== player.discordId && (
                <li>
                  • Discord ID: {player.discordId} → {discordId}
                </li>
              )}
            </ul>
          </div>
        )}
      </AdminActionModal>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Player Update</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to make the following changes to{" "}
              <span className="font-semibold">{player.minecraftUsername}</span>:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                Changes:
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {getChangesSummary().map((change, index) => (
                  <li key={index}>• {change}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                Reason:
              </p>
              <p className="text-sm text-muted-foreground">{reason}</p>
            </div>

            <p className="text-sm text-muted-foreground">
              This action will be logged in the audit trail and cannot be
              undone.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatePlayer.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              disabled={updatePlayer.isPending}
            >
              {updatePlayer.isPending ? "Updating..." : "Confirm & Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
