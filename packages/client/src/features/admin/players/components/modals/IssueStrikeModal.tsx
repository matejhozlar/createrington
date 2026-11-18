import { useState } from "react";
import { STRIKE_DESCRIPTION_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StrikeClassification } from "@createrington/shared/db";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface IssueStrikeModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
}

export function IssueStrikeModal({
  open,
  onClose,
  playerId,
}: IssueStrikeModalProps) {
  const [classification, setClassification] =
    useState<StrikeClassification>("rule_violation");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(1);

  const issueStrike = useMutation(
    trpc.admin.players.strikes.issue.mutationOptions(
      useMutationToast({
        success: "Strike issued",
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.players.pathFilter());
          setDescription("");
          setSeverity(1);
          onClose();
        },
      }),
    ),
  );

  const handleSubmit = () => {
    if (!description) return;

    issueStrike.mutate({
      id: playerId,
      classification,
      description,
      severity,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Issue Strike"
      onConfirm={handleSubmit}
      confirmLabel="Issue Strike"
      loading={issueStrike.isPending}
      disabled={!description}
    >
      <Field>
        <FieldLabel htmlFor="strike-classification">Classification</FieldLabel>
        <Select
          value={classification}
          onValueChange={(value) =>
            setClassification(value as StrikeClassification)
          }
        >
          <SelectTrigger id="strike-classification" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            <SelectItem value="pvp">PvP</SelectItem>
            <SelectItem value="theft">Theft</SelectItem>
            <SelectItem value="griefing">Griefing</SelectItem>
            <SelectItem value="laggy_machines">Laggy Machines</SelectItem>
            <SelectItem value="inappropriate_chat">
              Inappropriate Chat
            </SelectItem>
            <SelectItem value="harassment">Harassment</SelectItem>
            <SelectItem value="exploiting">Exploiting</SelectItem>
            <SelectItem value="rule_violation">Rule Violation</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="strike-severity">Severity (1-5)</FieldLabel>
        <Input
          id="strike-severity"
          type="number"
          min="1"
          max="5"
          value={severity}
          onChange={(e) =>
            setSeverity(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5)
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="strike-description">Description</FieldLabel>
        <Textarea
          id="strike-description"
          placeholder="Describe the violation..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={STRIKE_DESCRIPTION_MAX_LENGTH}
          rows={4}
        />
      </Field>
    </FormDialog>
  );
}
