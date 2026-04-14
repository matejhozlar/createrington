import { useRef, useState } from "react";
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
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import { CharCount } from "@/features/admin/components/CharCount";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { DiscordMarkdown } from "@/features/admin/tools/embed-builder/components/DiscordMarkdown";

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

  const mentionResolver = useMentionResolver();
  const contentRef = useRef<HTMLTextAreaElement>(null);
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
            <div className="flex items-center gap-1">
              <FieldLabel htmlFor="msg-content">Message</FieldLabel>
              <InsertMenu
                onInsert={(mention) => {
                  const el = contentRef.current;
                  const pos = el?.selectionStart ?? content.length;
                  const next =
                    content.slice(0, pos) + mention + content.slice(pos);
                  setContent(next);
                  requestAnimationFrame(() => {
                    if (el) {
                      const newPos = pos + mention.length;
                      el.selectionStart = newPos;
                      el.selectionEnd = newPos;
                      el.focus();
                    }
                  });
                }}
              />
            </div>
            <textarea
              ref={contentRef}
              id="msg-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The message the bot will send..."
              rows={4}
              maxLength={2000}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-between">
              <FieldDescription>
                Supports Discord markdown, mentions, and variables:{" "}
                <code className="text-[11px]">{"{memberCount}"}</code>
              </FieldDescription>
              <CharCount value={content} max={2000} />
            </div>
            {content.trim() && (
              <div
                className="rounded-md p-3 text-sm"
                style={{ backgroundColor: "#313338", color: "#DBDEE1" }}
              >
                <DiscordMarkdown
                  text={content}
                  mentionResolver={mentionResolver}
                />
              </div>
            )}
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
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
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
