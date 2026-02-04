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
import { adminPlayerApi } from "@/services/api/admin-players";

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

  const [classification, setClassification] =
    useState<StrikeClassification>("rule_violation");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!description) return;

    try {
      setLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      await adminPlayerApi.issueStrike(playerId, {
        classification,
        description,
        severity,
      });

      toast.success("Strike issued successfully!");
      setDescription("");
      setSeverity(1);
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Failed to issue strike:", err);
      toast.error("Failed to issue strike");
    } finally {
      setLoading(false);
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
              <SelectTrigger
                id="strike-classification"
                className="w-full cursor-pointer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]" position="popper">
                <SelectItem value="pvp" className="cursor-pointer">
                  PvP
                </SelectItem>
                <SelectItem value="theft" className="cursor-pointer">
                  Theft
                </SelectItem>
                <SelectItem value="griefing" className="cursor-pointer">
                  Griefing
                </SelectItem>
                <SelectItem value="laggy_machines" className="cursor-pointer">
                  Laggy Machines
                </SelectItem>
                <SelectItem
                  value="inappropriate_chat"
                  className="cursor-pointer"
                >
                  Inappropriate Chat
                </SelectItem>
                <SelectItem value="harassment" className="cursor-pointer">
                  Harassment
                </SelectItem>
                <SelectItem value="exploiting" className="cursor-pointer">
                  Exploiting
                </SelectItem>
                <SelectItem value="rule_violation" className="cursor-pointer">
                  Rule Violation
                </SelectItem>
                <SelectItem value="other" className="cursor-pointer">
                  Other
                </SelectItem>
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
              disabled={!description || loading}
            >
              {loading ? "Issuing..." : "Issue Strike"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
