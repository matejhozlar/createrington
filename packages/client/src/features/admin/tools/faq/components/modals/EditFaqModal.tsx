import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { MentionPicker } from "@/features/admin/components/MentionPicker";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["entries"][number];
type MatchMode = "keywords" | "regex";

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

  const responseRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(entry.title);
  const [matchMode, setMatchMode] = useState<MatchMode>(
    (entry.matchMode as MatchMode) || "keywords",
  );
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

    if (matchMode === "regex") {
      try {
        new RegExp(pattern, "i");
      } catch {
        toast.error("Invalid regex pattern");
        return;
      }
    }

    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        title: title.trim(),
        matchMode,
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
            <FieldLabel>Match Mode</FieldLabel>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={matchMode === "keywords" ? "default" : "outline"}
                onClick={() => setMatchMode("keywords")}
                className="cursor-pointer"
              >
                Keywords
              </Button>
              <Button
                type="button"
                size="sm"
                variant={matchMode === "regex" ? "default" : "outline"}
                onClick={() => setMatchMode("regex")}
                className="cursor-pointer"
              >
                Regex
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="faq-pattern">
              {matchMode === "keywords" ? "Keywords" : "Pattern (Regex)"}
            </FieldLabel>
            <Input
              id="faq-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={
                matchMode === "keywords"
                  ? "register, sign up, how to join"
                  : "how.*(register|sign up)"
              }
              className={matchMode === "regex" ? "font-mono" : ""}
            />
            <FieldDescription>
              {matchMode === "keywords"
                ? "Comma-separated words or phrases. A message matching any keyword will trigger this response."
                : "A regular expression pattern (case-insensitive). Use this for advanced matching."}
            </FieldDescription>
          </Field>

          <Field>
            <div className="flex items-center gap-1">
              <FieldLabel htmlFor="faq-response">Response</FieldLabel>
              <MentionPicker
                onInsert={(mention) => {
                  const el = responseRef.current;
                  const pos = el?.selectionStart ?? response.length;
                  const next =
                    response.slice(0, pos) + mention + response.slice(pos);
                  setResponse(next);
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
              ref={responseRef}
              id="faq-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="The auto-reply message... (supports **bold**, *italic*, `code`, etc.)"
              rows={4}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <FieldDescription>
              Supports Discord markdown: **bold**, *italic*, `code`,
              [links](url)
            </FieldDescription>
          </Field>

          <div className="flex items-end gap-4">
            <Field className="flex-1">
              <FieldLabel htmlFor="faq-priority">Priority</FieldLabel>
              <Input
                id="faq-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
              <FieldDescription>Higher = checked first</FieldDescription>
            </Field>

            <label className="flex h-9 cursor-pointer items-center gap-2 mb-6">
              <Checkbox
                id="faq-enabled"
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked === true)}
              />
              <span className="text-sm font-medium">Enabled</span>
            </label>
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
