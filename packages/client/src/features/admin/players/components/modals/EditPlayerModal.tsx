import { isDiscordId } from "@createrington/shared/discord-id";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import {
  trpc,
  queryClient,
  type RouterInput,
  type RouterOutput,
} from "@/lib/trpc";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

type FieldErrors = {
  minecraftUsername?: string;
  discordId?: string;
  reason?: string;
};

interface EditPlayerModalProps {
  open: boolean;
  onClose: () => void;
  player: PlayerDetailed["player"];
}

export function EditPlayerModal({
  open,
  onClose,
  player,
}: EditPlayerModalProps) {
  const [draft, update] = useDialogDraft<{
    minecraftUsername: string;
    discordId: string;
    reason: string;
    errors: FieldErrors;
    confirming: boolean;
  }>(open, () => ({
    minecraftUsername: player.minecraftUsername,
    discordId: player.discordId,
    reason: "",
    errors: {},
    confirming: false,
  }));
  const { minecraftUsername, discordId, reason, errors } = draft;
  const setErrors = (next: FieldErrors) => update({ errors: next });

  const updatePlayer = useMutation(
    trpc.admin.players.players.update.mutationOptions(
      useMutationToast({
        success: "Player updated",
        error: (err) => err.message || "Failed to update player",
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.players.pathFilter());
          onClose();
        },
      }),
    ),
  );

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {};

    const hasChanges =
      minecraftUsername.trim() !== player.minecraftUsername ||
      discordId.trim() !== player.discordId;

    if (!hasChanges) {
      newErrors.minecraftUsername = "No changes to save";
      setErrors(newErrors);
      return false;
    }

    if (minecraftUsername.trim().length === 0) {
      newErrors.minecraftUsername = "Minecraft username is required";
    } else if (minecraftUsername.trim().length > 16) {
      newErrors.minecraftUsername = "Username must not exceed 16 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(minecraftUsername.trim())) {
      newErrors.minecraftUsername =
        "Username can only contain letters, numbers, and underscores";
    }

    if (discordId.trim().length === 0) {
      newErrors.discordId = "Discord ID is required";
    } else if (!isDiscordId(discordId.trim())) {
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
      update({ confirming: true });
    }
  };

  const handleConfirmSubmit = async () => {
    const input: RouterInput["admin"]["players"]["players"]["update"] = {
      id: player.minecraftUuid,
      reason: reason.trim(),
    };

    if (minecraftUsername.trim() !== player.minecraftUsername) {
      input.minecraftUsername = minecraftUsername.trim();
    }
    if (discordId.trim() !== player.discordId) {
      input.discordId = discordId.trim();
    }

    await updatePlayer.mutateAsync(input);
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
      <FormDialog
        open={open}
        onClose={onClose}
        title="Edit Player"
        description="Update player information. All changes require a reason and will be logged in the audit trail."
        onConfirm={handleReviewChanges}
        confirmLabel="Review Changes"
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
              update({
                minecraftUsername: e.target.value,
                errors: { ...errors, minecraftUsername: undefined },
              });
            }}
            aria-invalid={!!errors.minecraftUsername}
            disabled={updatePlayer.isPending}
          />
          <FieldDescription>
            1-16 characters, letters, numbers, and underscores only
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
              update({
                discordId: e.target.value,
                errors: { ...errors, discordId: undefined },
              });
            }}
            aria-invalid={!!errors.discordId}
            disabled={updatePlayer.isPending}
          />
          <FieldDescription>17-20 digit Discord user ID</FieldDescription>
          {errors.discordId && <FieldError>{errors.discordId}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-reason">Reason for Update</FieldLabel>
          <Textarea
            id="edit-reason"
            placeholder="Explain why these changes are being made..."
            value={reason}
            maxLength={ADMIN_REASON_MAX_LENGTH}
            onChange={(e) => {
              update({
                reason: e.target.value,
                errors: { ...errors, reason: undefined },
              });
            }}
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
      </FormDialog>

      <ConfirmDialog
        open={draft.confirming}
        onOpenChange={(confirming) => update({ confirming })}
        title="Confirm Player Update"
        description={
          <>
            You are about to make the following changes to{" "}
            <span className="font-semibold">{player.minecraftUsername}</span>:
          </>
        }
        confirmLabel="Confirm & Update"
        onConfirm={handleConfirmSubmit}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Changes:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {getChangesSummary().map((change, index) => (
                <li key={index}>• {change}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Reason:</p>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            This action will be logged in the audit trail and cannot be undone.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
