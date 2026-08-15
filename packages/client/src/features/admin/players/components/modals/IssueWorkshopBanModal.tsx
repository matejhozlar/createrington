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
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { AdminActionModal } from "./AdminActionModal";

const DURATIONS = [1, 3, 7, 14, 30, 60, 90];

const GLOBAL_SCOPE = "global";

interface IssueWorkshopBanModalProps {
  open: boolean;
  onClose: () => void;
  discordId: string;
  playerUsername: string;
  onSuccess: () => void;
}

type BanType = "temporary" | "permanent";

export function IssueWorkshopBanModal({
  open,
  onClose,
  discordId,
  playerUsername,
  onSuccess,
}: IssueWorkshopBanModalProps) {
  const toast = useToastActions();
  const issueBan = trpc.admin.workshops.bans.issue.useMutation();
  const workshops = trpc.admin.workshops.list.useQuery(undefined, {
    enabled: open,
  });

  const [scope, setScope] = useState<string>(GLOBAL_SCOPE);
  const [banType, setBanType] = useState<BanType>("temporary");
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState(7);

  const handleClose = () => {
    setScope(GLOBAL_SCOPE);
    setBanType("temporary");
    setReason("");
    setDurationDays(7);
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    try {
      await issueBan.mutateAsync({
        discordId,
        workshopId: scope === GLOBAL_SCOPE ? null : Number(scope),
        reason: reason.trim(),
        durationDays: banType === "temporary" ? durationDays : undefined,
      });
      toast.success(`${playerUsername} can no longer submit suggestions`);
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to issue the ban",
      );
    }
  };

  return (
    <AdminActionModal
      open={open}
      onClose={handleClose}
      title="Block workshop suggestions"
      description={`${playerUsername} will not be able to submit new mod suggestions. Minecraft access, Discord membership, upvotes and their existing suggestions are unaffected.`}
      onConfirm={handleSubmit}
      confirmLabel="Block Suggestions"
      loadingLabel="Blocking..."
      loading={issueBan.isPending}
      disabled={!reason.trim()}
    >
      <Field>
        <FieldLabel htmlFor="workshop-ban-scope">Scope</FieldLabel>
        <Select value={scope} onValueChange={setScope}>
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
      </Field>

      <Field>
        <FieldLabel htmlFor="workshop-ban-type">Duration</FieldLabel>
        <Select
          value={banType}
          onValueChange={(value) => setBanType(value as BanType)}
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
            onValueChange={(value) => setDurationDays(Number(value))}
          >
            <SelectTrigger id="workshop-ban-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days} {days === 1 ? "day" : "days"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="workshop-ban-reason">Reason</FieldLabel>
        <Input
          id="workshop-ban-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Shown to the user when they try to suggest"
          maxLength={500}
        />
      </Field>
    </AdminActionModal>
  );
}
