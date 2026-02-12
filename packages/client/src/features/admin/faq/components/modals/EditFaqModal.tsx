import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["entries"][number];

interface EditFaqModalProps {
  open: boolean;
  onClose: () => void;
  entry: FaqEntry;
  onSuccess: () => void;
}

export function EditFaqModal({
  open,
  onClose,
  entry,
  onSuccess,
}: EditFaqModalProps) {
  const toast = useToastActions();
  const updateEntry = trpc.admin.faq.update.useMutation();

  const [title, setTitle] = useState(entry.title);
  const [pattern, setPattern] = useState(entry.pattern);
  const [response, setResponse] = useState(entry.response);
  const [priority, setPriority] = useState(entry.priority);
  const [enabled, setEnabled] = useState(entry.enabled);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !pattern.trim() || !response.trim()) {
      toast.error("All fields are required");
      return;
    }

    try {
      new RegExp(pattern, "i");
    } catch {
      toast.error("Invalid regex pattern");
      return;
    }

    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        title: title.trim(),
        pattern: pattern.trim(),
        response: response.trim(),
        priority,
        enabled,
      });

      toast.success("FAQ entry updated");
      onSuccess();
    } catch (err) {
      console.error("Failed to update FAQ entry:", err);
      toast.error("Failed to update FAQ entry");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit FAQ Entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="faq-title">Title</FieldLabel>
            <Input
              id="faq-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to Register"
              maxLength={100}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="faq-pattern">Pattern (Regex)</FieldLabel>
            <Input
              id="faq-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. how.*(register|sign up)"
              className="font-mono"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="faq-response">Response</FieldLabel>
            <textarea
              id="faq-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="The auto-reply message..."
              rows={4}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>

          <div className="flex gap-4">
            <Field>
              <FieldLabel htmlFor="faq-priority">Priority</FieldLabel>
              <Input
                id="faq-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="faq-enabled">Enabled</FieldLabel>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id="faq-enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">{enabled ? "Yes" : "No"}</span>
              </label>
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
              disabled={updateEntry.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={updateEntry.isPending}
            >
              {updateEntry.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
