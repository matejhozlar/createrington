import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { queryClient, trpc } from "@/lib/trpc";
import {
  PLANNING_ITEM_STATUSES,
  PLANNING_TEXT_MAX_LENGTH,
  PLANNING_TITLE_MAX_LENGTH,
  type PlanningItemStatus,
} from "@createrington/shared/planning";
import { STATUS_CONFIG } from "../constants";
import {
  afterSave,
  changedFields,
  isNewerThan,
  toEditBase,
  type Draft,
} from "../editing";
import type { PlanningItemDetail, PlanningSubcategory } from "../types";
import { AssigneePicker } from "./AssigneePicker";
import { CategoryFields } from "./CategoryFields";

interface ItemEditorProps {
  item: PlanningItemDetail;
  subcategories: PlanningSubcategory[];
  onDeleted: () => void;
}

export function ItemEditor({
  item,
  subcategories,
  onDeleted,
}: ItemEditorProps) {
  const [base, setBase] = useState(() => toEditBase(item));
  const [draft, setDraft] = useState(base.draft);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const patch = changedFields(draft, base.draft);
  const dirty = Object.keys(patch).length > 0;

  const loadLatest = () => {
    const latest = toEditBase(item);
    setBase(latest);
    setDraft(latest.draft);
  };

  const outdated = isNewerThan(item, base);
  if (outdated && !dirty) loadLatest();

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.admin.planning.pathFilter());

  const save = useMutation(
    trpc.admin.planning.items.update.mutationOptions(
      useMutationToast({
        success: "Card saved",
        onSuccess: () => void invalidate(),
        onError: () => void invalidate(),
      }),
    ),
  );

  const setAssignees = useMutation(
    trpc.admin.planning.items.assignees.set.mutationOptions(
      useMutationToast({ onSuccess: () => void invalidate() }),
    ),
  );

  const deleteItem = useMutation(
    trpc.admin.planning.items.delete.mutationOptions(
      useMutationToast({
        success: "Card deleted",
        onSuccess: () => {
          void invalidate();
          onDeleted();
        },
      }),
    ),
  );

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!dirty || !draft.title.trim()) return;
          save.mutate(
            { id: item.id, revision: base.revision, ...patch },
            {
              onSuccess: ({ revision }) =>
                setBase(afterSave(base, patch, revision)),
            },
          );
        }}
      >
        {outdated && (
          <Alert>
            <AlertTitle>This card changed while you were editing</AlertTitle>
            <AlertDescription>
              <p>
                Saving is blocked so nobody&apos;s edit gets overwritten. Copy
                what you want to keep, then load the latest version.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadLatest}
              >
                Load the latest
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="planning-item-title">Title</FieldLabel>
          <Input
            id="planning-item-title"
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
            maxLength={PLANNING_TITLE_MAX_LENGTH}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="planning-item-status">Status</FieldLabel>
          <Select
            value={draft.status}
            onValueChange={(value) =>
              set("status", value as PlanningItemStatus)
            }
          >
            <SelectTrigger id="planning-item-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANNING_ITEM_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_CONFIG[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <CategoryFields
          idPrefix="planning-item"
          category={draft.category}
          subcategoryId={draft.subcategoryId}
          subcategories={subcategories}
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
        />

        <Field>
          <FieldLabel htmlFor="planning-item-body">Details</FieldLabel>
          <Textarea
            id="planning-item-body"
            value={draft.body}
            onChange={(event) => set("body", event.target.value)}
            rows={7}
            maxLength={PLANNING_TEXT_MAX_LENGTH}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="planning-item-decision">Decision</FieldLabel>
          <Textarea
            id="planning-item-decision"
            value={draft.decision}
            onChange={(event) => set("decision", event.target.value)}
            rows={3}
            maxLength={PLANNING_TEXT_MAX_LENGTH}
          />
          <FieldDescription>
            What was agreed and why, once there is an answer.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Assigned to</FieldLabel>
          <AssigneePicker
            value={item.assignees.map((assignee) => assignee.discordId)}
            onChange={(discordIds) =>
              setAssignees.mutate({ id: item.id, discordIds })
            }
            disabled={setAssignees.isPending}
          />
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button
            type="submit"
            disabled={!dirty || !draft.title.trim() || outdated}
            loading={save.isPending}
          >
            Save Changes
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete Card"
        description={
          <>
            Delete <span className="font-semibold">"{item.title}"</span> with
            its comments and its whole history? If the idea was turned down,
            move it to Rejected instead so the reasoning stays.
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteItem.mutateAsync({ id: item.id })}
      />
    </>
  );
}
