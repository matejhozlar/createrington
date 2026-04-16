import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Preset durations in milliseconds, keyed off the select value string.
const DURATION_PRESETS: Record<string, number> = {
  "10m": 10 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function CreatePromptModal({ open, onClose, onSuccess }: Props) {
  const toast = useToastActions();
  const createMutation = trpc.admin.prompts.create.useMutation();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [durationPreset, setDurationPreset] = useState<string>("24h");
  const [rolePingId, setRolePingId] = useState("");

  const reset = () => {
    setQuestion("");
    setDescription("");
    setDurationPreset("24h");
    setRolePingId("");
  };

  const handleClose = () => {
    if (createMutation.isPending) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Question is required");
      return;
    }
    const durationMs = DURATION_PRESETS[durationPreset];
    if (!durationMs) {
      toast.error("Select a valid duration");
      return;
    }

    try {
      await createMutation.mutateAsync({
        question: trimmedQuestion,
        description: description.trim() || undefined,
        durationMs,
        rolePingId: rolePingId.trim() || undefined,
      });
      toast.success("Prompt posted to Discord");
      reset();
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Player Prompt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="prompt-question">Question</FieldLabel>
            <Input
              id="prompt-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What should we focus on next month?"
              maxLength={256}
              autoFocus
              required
            />
            <FieldDescription>
              Shown as the embed title on Discord.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-description">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <textarea
              id="prompt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context or examples to help players answer."
              rows={3}
              maxLength={2000}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-duration">
              Responses open for
            </FieldLabel>
            <Select value={durationPreset} onValueChange={setDurationPreset}>
              <SelectTrigger id="prompt-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10m">10 minutes</SelectItem>
                <SelectItem value="30m">30 minutes</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="6h">6 hours</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
                <SelectItem value="3d">3 days</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="prompt-role">
              Role to ping{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="prompt-role"
              value={rolePingId}
              onChange={(e) => setRolePingId(e.target.value)}
              placeholder="Discord role ID (digits only)"
              pattern="\d*"
              inputMode="numeric"
            />
            <FieldDescription>
              Copy the role ID from Discord (Server Settings → Roles →
              right-click → Copy Role ID). Leave blank to post without a ping.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Posting..." : "Post to Discord"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
