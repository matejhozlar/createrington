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
import { X } from "lucide-react";
import type { StrikeClassification } from "@createrington/shared/db";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface IssueStrikeModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  onSuccess: () => void;
}

export function IssueStrikeModal({
  open,
  onClose,
  playerId,
  onSuccess,
}: IssueStrikeModalProps) {
  const toast = useToastActions();
  const issueStrike = trpc.admin.players.strikes.issue.useMutation();

  const [classification, setClassification] =
    useState<StrikeClassification>("rule_violation");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(1);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!description) return;

    try {
      await issueStrike.mutateAsync({
        id: playerId,
        classification,
        description,
        severity,
      });

      toast.success("Strike issued successfully!");
      setDescription("");
      setSeverity(1);
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to issue strike");
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
          <h3 className="text-lg font-semibold">Issue Strike</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="strike-classification">
              Classification
            </FieldLabel>
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
            <textarea
              id="strike-description"
              placeholder="Describe the violation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={4}
            />
          </Field>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 cursor-pointer"
              onClick={handleSubmit}
              disabled={!description || issueStrike.isPending}
            >
              {issueStrike.isPending ? "Issuing..." : "Issue Strike"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
