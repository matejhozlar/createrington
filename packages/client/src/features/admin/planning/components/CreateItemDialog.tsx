import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDialog } from "@/components/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { queryClient, trpc } from "@/lib/trpc";
import {
  PLANNING_TEXT_MAX_LENGTH,
  PLANNING_TITLE_MAX_LENGTH,
  type PlanningCategory,
} from "@createrington/shared/planning";
import type { PlanningSubcategory } from "../types";
import { AssigneePicker } from "./AssigneePicker";
import { CategoryFields } from "./CategoryFields";

interface CreateItemDialogProps {
  open: boolean;
  onClose: () => void;
  defaultCategory: PlanningCategory;
  subcategories: PlanningSubcategory[];
}

export function CreateItemDialog({
  open,
  onClose,
  defaultCategory,
  subcategories,
}: CreateItemDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const createItem = useMutation(
    trpc.admin.planning.items.create.mutationOptions(
      useMutationToast({
        success: "Card added to the inbox",
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.planning.pathFilter());
          setTitle("");
          setBody("");
          setSubcategoryId(null);
          setAssigneeIds([]);
          onClose();
        },
      }),
    ),
  );

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="New Card"
      description="An idea, a problem or an open question. It starts in the inbox."
      onConfirm={() =>
        createItem.mutate({ title, body, category, subcategoryId, assigneeIds })
      }
      confirmLabel="Add Card"
      loading={createItem.isPending}
      disabled={!title.trim()}
      contentClassName="sm:max-w-lg"
      asForm
    >
      <Field>
        <FieldLabel htmlFor="planning-new-title">Title</FieldLabel>
        <Input
          id="planning-new-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Money has nothing worth buying"
          maxLength={PLANNING_TITLE_MAX_LENGTH}
        />
      </Field>

      <CategoryFields
        idPrefix="planning-new"
        category={category}
        subcategoryId={subcategoryId}
        subcategories={subcategories}
        onChange={(next) => {
          setCategory(next.category);
          setSubcategoryId(next.subcategoryId);
        }}
      />

      <Field>
        <FieldLabel htmlFor="planning-new-body">Details</FieldLabel>
        <Textarea
          id="planning-new-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What is the idea or the problem?"
          rows={5}
          maxLength={PLANNING_TEXT_MAX_LENGTH}
        />
      </Field>

      <Field>
        <FieldLabel>Assigned to</FieldLabel>
        <AssigneePicker value={assigneeIds} onChange={setAssigneeIds} />
      </Field>
    </FormDialog>
  );
}
