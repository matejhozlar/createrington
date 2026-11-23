import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { FormDialog } from "@/components/form-dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { pluralize } from "@/lib/format";

const DURATIONS = [1, 3, 7, 14, 30, 60, 90];

const GLOBAL_SCOPE = "global";

interface IssueWorkshopBanModalProps {
  open: boolean;
  onClose: () => void;
  discordId: string;
  playerUsername: string;
}

type BanType = "temporary" | "permanent";

const EMPTY_DRAFT: {
  scope: string;
  banType: BanType;
  reason: string;
  durationDays: number;
} = {
  scope: GLOBAL_SCOPE,
  banType: "temporary",
  reason: "",
  durationDays: 7,
};

export function IssueWorkshopBanModal({
  open,
  onClose,
  discordId,
  playerUsername,
}: IssueWorkshopBanModalProps) {
  const workshops = useQuery(
    trpc.admin.workshops.list.queryOptions(undefined, {
      enabled: open,
    }),
  );

  const [draft, update] = useDialogDraft(open, EMPTY_DRAFT);
  const { scope, banType, reason, durationDays } = draft;

  const issueBan = useMutation(
    trpc.admin.workshops.bans.issue.mutationOptions(
      useMutationToast({
        success: `${playerUsername} can no longer submit suggestions`,
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.workshops.bans.pathFilter(),
          );
          onClose();
        },
      }),
    ),
  );

  const handleSubmit = () => {
    issueBan.mutate({
      discordId,
      workshopId: scope === GLOBAL_SCOPE ? null : Number(scope),
      reason: reason.trim(),
      durationDays: banType === "temporary" ? durationDays : undefined,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Block workshop suggestions"
      description={`${playerUsername} will not be able to submit new mod suggestions. Minecraft access, Discord membership, upvotes and their existing suggestions are unaffected.`}
      onConfirm={handleSubmit}
      confirmLabel="Block Suggestions"
      loading={issueBan.isPending}
      disabled={!reason.trim() || workshops.isLoading || !!workshops.error}
    >
      <Field>
        <FieldLabel htmlFor="workshop-ban-scope">Scope</FieldLabel>
        <Select
          value={scope}
          onValueChange={(value) => update({ scope: value })}
          disabled={workshops.isLoading || !!workshops.error}
        >
          <SelectTrigger id="workshop-ban-scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL_SCOPE}>Every workshop</SelectItem>
            {workshops.data?.map((workshop) => (
              <SelectItem key={workshop.id} value={String(workshop.id)}>
                {workshop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {workshops.isLoading && (
          <p className="text-xs text-muted-foreground">Loading workshops...</p>
        )}
        {workshops.error && (
          <p className="text-xs text-destructive">
            Could not load workshops: {workshops.error.message}
          </p>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="workshop-ban-type">Duration</FieldLabel>
        <Select
          value={banType}
          onValueChange={(value) => update({ banType: value as BanType })}
        >
          <SelectTrigger id="workshop-ban-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="temporary">Temporary</SelectItem>
            <SelectItem value="permanent">Permanent</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {banType === "temporary" && (
        <Field>
          <FieldLabel htmlFor="workshop-ban-duration">Length</FieldLabel>
          <Select
            value={String(durationDays)}
            onValueChange={(value) => update({ durationDays: Number(value) })}
          >
            <SelectTrigger id="workshop-ban-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {pluralize(days, "day")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="workshop-ban-reason">Reason</FieldLabel>
        <Textarea
          id="workshop-ban-reason"
          placeholder="Shown to the user when they try to suggest"
          value={reason}
          onChange={(e) => update({ reason: e.target.value })}
          rows={4}
          maxLength={500}
        />
      </Field>
    </FormDialog>
  );
}
