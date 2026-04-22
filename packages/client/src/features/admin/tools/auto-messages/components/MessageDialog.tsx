import { useRef, useState } from "react";
import { ArrowDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

const MAX_FOLLOWUPS = 5;
const MAX_DELAY_SECONDS = 3600;

interface FollowupDraft {
  content: string;
  delaySeconds: number;
  enabled: boolean;
}

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
  const [followups, setFollowups] = useState<FollowupDraft[]>(
    message?.followups?.map((f) => ({
      content: f.content,
      delaySeconds: f.delaySeconds,
      enabled: f.enabled,
    })) ?? [],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const addFollowup = () => {
    if (followups.length >= MAX_FOLLOWUPS) return;
    setFollowups([
      ...followups,
      { content: "", delaySeconds: 5, enabled: true },
    ]);
  };

  const updateFollowup = (index: number, patch: Partial<FollowupDraft>) => {
    setFollowups((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  };

  const removeFollowup = (index: number) => {
    setFollowups((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Message content is required");
      return;
    }

    for (let i = 0; i < followups.length; i++) {
      const f = followups[i];
      if (!f.content.trim()) {
        toast.error(`Follow-up #${i + 1} content is required`);
        return;
      }
      if (
        !Number.isFinite(f.delaySeconds) ||
        f.delaySeconds < 1 ||
        f.delaySeconds > MAX_DELAY_SECONDS
      ) {
        toast.error(
          `Follow-up #${i + 1} delay must be between 1 and ${MAX_DELAY_SECONDS} seconds`,
        );
        return;
      }
    }

    const followupsPayload = followups.map((f) => ({
      content: f.content.trim(),
      delaySeconds: f.delaySeconds,
      enabled: f.enabled,
    }));

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: message.id,
          content: content.trim(),
          enabled,
          followups: followupsPayload,
        });
        toast.success("Message updated");
      } else {
        await createMutation.mutateAsync({
          configId,
          content: content.trim(),
          enabled,
          followups: followupsPayload,
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <div className="border-border border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Follow-up Messages</h4>
                <p className="text-muted-foreground text-xs">
                  Sent in sequence after the primary message. Max{" "}
                  {MAX_FOLLOWUPS}.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addFollowup}
                disabled={followups.length >= MAX_FOLLOWUPS || isPending}
              >
                <Plus className="mr-1 size-3" />
                Add follow-up
              </Button>
            </div>

            {followups.length > 0 && (
              <div className="space-y-3">
                {followups.map((followup, index) => (
                  <FollowupRow
                    key={index}
                    index={index}
                    followup={followup}
                    mentionResolver={mentionResolver}
                    onChange={(patch) => updateFollowup(index, patch)}
                    onRemove={() => removeFollowup(index)}
                  />
                ))}
              </div>
            )}
          </div>

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

interface FollowupRowProps {
  index: number;
  followup: FollowupDraft;
  mentionResolver: ReturnType<typeof useMentionResolver>;
  onChange: (patch: Partial<FollowupDraft>) => void;
  onRemove: () => void;
}

function FollowupRow({
  index,
  followup,
  mentionResolver,
  onChange,
  onRemove,
}: FollowupRowProps) {
  return (
    <div className="border-border/60 bg-muted/30 relative rounded-md border-l-2 p-3 pl-4">
      <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
        <ArrowDown className="size-3" />
        <span>
          Follow-up #{index + 1} · sent {followup.delaySeconds}s after previous
        </span>
      </div>

      <div className="space-y-2">
        <textarea
          value={followup.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder={`Follow-up message content...`}
          rows={2}
          maxLength={2000}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
        <div className="flex justify-end">
          <CharCount value={followup.content} max={2000} />
        </div>

        {followup.content.trim() && (
          <div
            className="rounded-md p-2 text-sm"
            style={{ backgroundColor: "#313338", color: "#DBDEE1" }}
          >
            <DiscordMarkdown
              text={followup.content}
              mentionResolver={mentionResolver}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Delay (seconds)</span>
            <Input
              type="number"
              min={1}
              max={MAX_DELAY_SECONDS}
              value={followup.delaySeconds}
              onChange={(e) =>
                onChange({ delaySeconds: Number(e.target.value) })
              }
              className="h-8 w-24"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={followup.enabled}
              onCheckedChange={(checked) =>
                onChange({ enabled: checked === true })
              }
            />
            <span className="font-medium">Enabled</span>
          </label>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="text-destructive hover:text-destructive ml-auto h-8"
          >
            <Trash2 className="mr-1 size-3" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
