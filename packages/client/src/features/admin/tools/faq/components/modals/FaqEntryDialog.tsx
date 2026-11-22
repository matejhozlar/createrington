import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceField } from "@/components/choice-field";
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
import type { FaqMatchMode } from "@createrington/shared/faq";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["items"][number];

type FaqDraft = Pick<
  FaqEntry,
  "title" | "matchMode" | "pattern" | "response" | "priority" | "enabled"
>;

const EMPTY_DRAFT: FaqDraft = {
  title: "",
  matchMode: "keywords",
  pattern: "",
  response: "",
  priority: 0,
  enabled: true,
};

const MATCH_MODE_OPTIONS: { value: FaqMatchMode; label: string }[] = [
  { value: "keywords", label: "Keywords" },
  { value: "regex", label: "Regex" },
];

const MATCH_MODE_COPY: Record<
  FaqMatchMode,
  { label: string; placeholder: string; description: string }
> = {
  keywords: {
    label: "Keywords",
    placeholder: "register, sign up, how to join",
    description:
      "Comma-separated words or phrases. A message matching any keyword will trigger this response.",
  },
  regex: {
    label: "Pattern (Regex)",
    placeholder: "how.*(register|sign up)",
    description:
      "A regular expression pattern (case-insensitive). Use this for advanced matching.",
  },
};

function toDraft(entry: FaqEntry | null | undefined): FaqDraft {
  if (!entry) return EMPTY_DRAFT;
  const { title, matchMode, pattern, response, priority, enabled } = entry;
  return { title, matchMode, pattern, response, priority, enabled };
}

export function FaqEntryDialog({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  entry?: FaqEntry | null;
}) {
  const toast = useToastActions();
  const isEdit = !!entry;

  const mentionResolver = useMentionResolver();
  const responseRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<FaqDraft>(() => toDraft(entry));
  const update = (patch: Partial<FaqDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const handleSaved = () => {
    void queryClient.invalidateQueries(trpc.admin.faq.pathFilter());
    if (!isEdit) setDraft(EMPTY_DRAFT);
    onClose();
  };

  const createEntry = useMutation(
    trpc.admin.faq.create.mutationOptions(
      useMutationToast({
        success: "FAQ entry created",
        onSuccess: handleSaved,
      }),
    ),
  );
  const updateEntry = useMutation(
    trpc.admin.faq.update.mutationOptions(
      useMutationToast({
        success: "FAQ entry updated",
        onSuccess: handleSaved,
      }),
    ),
  );

  const handleSubmit = () => {
    const title = draft.title.trim();
    const pattern = draft.pattern.trim();
    const response = draft.response.trim();
    if (!title || !pattern || !response) {
      toast.error("All fields are required");
      return;
    }

    if (draft.matchMode === "regex") {
      try {
        new RegExp(pattern, "i");
      } catch {
        toast.error("Invalid regex pattern");
        return;
      }
    }

    const input = { ...draft, title, pattern, response };
    if (isEdit) {
      updateEntry.mutate({ id: entry.id, ...input });
    } else {
      createEntry.mutate(input);
    }
  };

  const modeCopy = MATCH_MODE_COPY[draft.matchMode];

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit FAQ Entry" : "Create FAQ Entry"}
      onConfirm={handleSubmit}
      confirmLabel={isEdit ? "Save Changes" : "Create"}
      loading={createEntry.isPending || updateEntry.isPending}
      contentClassName="sm:max-w-lg"
      asForm
    >
      <Field>
        <FieldLabel htmlFor="faq-title">Title</FieldLabel>
        <Input
          id="faq-title"
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. How to Register"
          maxLength={100}
        />
      </Field>

      <Field>
        <FieldLabel>Match Mode</FieldLabel>
        <ChoiceField
          value={draft.matchMode}
          options={MATCH_MODE_OPTIONS}
          onChange={(matchMode) => update({ matchMode })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="faq-pattern">{modeCopy.label}</FieldLabel>
        <Input
          id="faq-pattern"
          value={draft.pattern}
          onChange={(e) => update({ pattern: e.target.value })}
          placeholder={modeCopy.placeholder}
          className={draft.matchMode === "regex" ? "font-mono" : ""}
        />
        <FieldDescription>{modeCopy.description}</FieldDescription>
      </Field>

      <Field>
        <div className="flex items-center gap-1">
          <FieldLabel htmlFor="faq-response">Response</FieldLabel>
          <InsertMenu
            onInsert={(mention) =>
              insertAtCursor(
                responseRef.current,
                draft.response,
                mention,
                (response) => update({ response }),
              )
            }
          />
        </div>
        <Textarea
          ref={responseRef}
          id="faq-response"
          value={draft.response}
          onChange={(e) => update({ response: e.target.value })}
          placeholder="The auto-reply message..."
          rows={4}
        />
        <div className="flex items-center justify-between">
          <FieldDescription>
            Supports Discord markdown and mentions
          </FieldDescription>
          <CharCount value={draft.response} max={2000} />
        </div>
        {draft.response.trim() && (
          <div
            className="rounded-md p-3 text-sm"
            style={{ backgroundColor: "#313338", color: "#DBDEE1" }}
          >
            <DiscordMarkdown
              text={draft.response}
              mentionResolver={mentionResolver}
            />
          </div>
        )}
      </Field>

      <div className="flex items-end gap-4">
        <Field className="flex-1">
          <FieldLabel htmlFor="faq-priority">Priority</FieldLabel>
          <Input
            id="faq-priority"
            type="number"
            value={draft.priority}
            onChange={(e) => update({ priority: Number(e.target.value) })}
          />
          <FieldDescription>Higher = checked first</FieldDescription>
        </Field>

        <label className="mb-6 flex h-9 cursor-pointer items-center gap-2">
          <Checkbox
            id="faq-enabled"
            checked={draft.enabled}
            onCheckedChange={(checked) => update({ enabled: checked === true })}
          />
          <span className="text-sm font-medium">Enabled</span>
        </label>
      </div>
    </FormDialog>
  );
}
