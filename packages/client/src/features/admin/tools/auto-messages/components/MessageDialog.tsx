import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Message =
  RouterOutput["admin"]["autoMessages"]["configs"]["get"]["messages"][number];

interface MessageDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configId: number;
  message?: Message | null;
}

export function MessageDialog({
  open,
  onClose,
  onSuccess,
  configId,
  message,
}: MessageDialogProps) {
  const toast = useToastActions();
  const isEdit = !!message;

  const createMutation = trpc.admin.autoMessages.messages.create.useMutation();
  const updateMutation = trpc.admin.autoMessages.messages.update.useMutation();

  const [content, setContent] = useState(message?.content ?? "");
  const [enabled, setEnabled] = useState(message?.enabled ?? true);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Message content is required");
      return;
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: message.id,
          content: content.trim(),
          enabled,
        });
        toast.success("Message updated");
      } else {
        await createMutation.mutateAsync({
          configId,
          content: content.trim(),
          enabled,
        });
        toast.success("Message added");
      }
      onSuccess();
    } catch {
      toast.error(`Failed to ${isEdit ? "update" : "add"} message`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Message" : "Add Message"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="msg-content">Message</FieldLabel>
            <textarea
              id="msg-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The message the bot will send..."
              rows={4}
              maxLength={2000}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <FieldDescription>
              {content.length}/2000 — supports Discord markdown
            </FieldDescription>
          </Field>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={isPending}
            >
              {isPending
                ? isEdit
                  ? "Saving..."
                  : "Adding..."
                : isEdit
                  ? "Save"
                  : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
