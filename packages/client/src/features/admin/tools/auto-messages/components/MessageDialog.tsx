import { useRef } from "react";
import { ArrowDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/form-dialog";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { insertAtCursor } from "@/lib/insertAtCursor";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { InsertMenu } from "@/features/admin/components/InsertMenu";
import { CharCount } from "@/features/admin/components/CharCount";
import { useMentionResolver } from "@/features/admin/hooks/use-mention-resolver";
import { DiscordMarkdown } from "@/features/admin/tools/embed-builder/components/DiscordMarkdown";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useDialogDraft } from "@/hooks/use-dialog-draft";

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
  configId: number;
  message?: Message | null;
}

export function MessageDialog({
  open,
  onClose,
  configId,
  message,
}: MessageDialogProps) {
  const toast = useToastActions();
  const isEdit = !!message;

  const handleSaved = () => {
    void queryClient.invalidateQueries(
      trpc.admin.autoMessages.configs.pathFilter(),
    );
    onClose();
  };

  const createMutation = useMutation(
    trpc.admin.autoMessages.messages.create.mutationOptions(
      useMutationToast({ success: "Message added", onSuccess: handleSaved }),
    ),
  );
  const updateMutation = useMutation(
    trpc.admin.autoMessages.messages.update.mutationOptions(
      useMutationToast({ success: "Message updated", onSuccess: handleSaved }),
    ),
  );

  const mentionResolver = useMentionResolver();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [draft, update] = useDialogDraft<{
    content: string;
    enabled: boolean;
    followups: FollowupDraft[];
  }>(open, () => ({
    content: message?.content ?? "",
    enabled: message?.enabled ?? true,
    followups:
      message?.followups?.map((f) => ({
        content: f.content,
        delaySeconds: f.delaySeconds,
        enabled: f.enabled,
      })) ?? [],
  }));
  const { content, enabled, followups } = draft;

  const isPending = createMutation.isPending || updateMutation.isPending;

  const addFollowup = () => {
    if (followups.length >= MAX_FOLLOWUPS) return;
    update({
      followups: [
        ...followups,
        { content: "", delaySeconds: 5, enabled: true },
      ],
    });
  };

  const updateFollowup = (index: number, patch: Partial<FollowupDraft>) => {
    update((d) => ({
      followups: d.followups.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      ),
    }));
  };

  const removeFollowup = (index: number) => {
    update((d) => ({ followups: d.followups.filter((_, i) => i !== index) }));
  };

  const handleSubmit = () => {
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

    if (isEdit) {
      updateMutation.mutate({
        id: message.id,
        content: content.trim(),
        enabled,
        followups: followupsPayload,
      });
    } else {
      createMutation.mutate({
        configId,
        content: content.trim(),
        enabled,
        followups: followupsPayload,
      });
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Message" : "Add Message"}
      onConfirm={handleSubmit}
      confirmLabel={isEdit ? "Save" : "Add"}
      loading={isPending}
      contentClassName="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      asForm
    >
      <Field>
        <div className="flex items-center gap-1">
          <FieldLabel htmlFor="msg-content">Message</FieldLabel>
          <InsertMenu
            onInsert={(mention) =>
              insertAtCursor(
                contentRef.current,
                content,
                mention,
                (value: string) => update({ content: value }),
              )
            }
          />
        </div>
        <Textarea
          ref={contentRef}
          id="msg-content"
          value={content}
          onChange={(e) => update({ content: e.target.value })}
          placeholder="The message the bot will send..."
          rows={4}
          maxLength={2000}
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
            <DiscordMarkdown text={content} mentionResolver={mentionResolver} />
          </div>
        )}
      </Field>

      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => update({ enabled: checked === true })}
        />
        <span className="text-sm font-medium">Enabled</span>
      </label>

      <div className="border-border border-t pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Follow-up Messages</h4>
            <p className="text-muted-foreground text-xs">
              Sent in sequence after the primary message. Max {MAX_FOLLOWUPS}.
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
    </FormDialog>
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
        <Textarea
          value={followup.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder={`Follow-up message content...`}
          rows={2}
          maxLength={2000}
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
