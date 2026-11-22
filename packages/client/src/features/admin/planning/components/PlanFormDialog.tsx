import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { FormDialog } from "@/components/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { queryClient, trpc } from "@/lib/trpc";
import {
  PLANNING_ITEM_STATUSES,
  PLANNING_TEXT_MAX_LENGTH,
  PLANNING_TITLE_MAX_LENGTH,
  type PlanningCategory,
  type PlanningItemStatus,
} from "@createrington/shared/planning";
import { STATUS_CONFIG } from "../constants";
import type { PlanningItemDetail } from "../types";
import { AssigneePicker } from "./AssigneePicker";
import { CategoryFields } from "./CategoryFields";
import { MarkdownField } from "./MarkdownField";

interface PlanFormDialogProps {
  open: boolean;
  onClose: () => void;
  item?: PlanningItemDetail;
  defaultCategory?: PlanningCategory;
}

export function PlanFormDialog({
  open,
  onClose,
  item,
  defaultCategory = "modpack",
}: PlanFormDialogProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [category, setCategory] = useState(item?.category ?? defaultCategory);
  const [subcategoryId, setSubcategoryId] = useState(
    item?.subcategoryId ?? null,
  );
  const [status, setStatus] = useState<PlanningItemStatus>(
    item?.status ?? "draft",
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [revision] = useState(item?.revision);

  const subcategoriesQuery = useQuery(
    trpc.admin.planning.subcategories.list.queryOptions(),
  );

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.admin.planning.pathFilter());

  const create = useMutation(
    trpc.admin.planning.items.create.mutationOptions(
      useMutationToast({
        success: "Plan saved as a draft",
        onSuccess: ({ id }) => {
          void invalidate();
          onClose();
          void navigate(`/admin/planning/${id}`);
        },
      }),
    ),
  );

  const update = useMutation(
    trpc.admin.planning.items.update.mutationOptions(
      useMutationToast({
        success: "Plan saved",
        onSuccess: () => {
          void invalidate();
          onClose();
        },
        onError: () => void invalidate(),
      }),
    ),
  );

  const submit = () => {
    if (item && revision !== undefined) {
      update.mutate({
        id: item.id,
        revision,
        title,
        body,
        category,
        subcategoryId,
        status,
      });
      return;
    }
    create.mutate({ title, body, category, subcategoryId, assigneeIds });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={item ? "Edit Plan" : "New Plan"}
      description={
        item
          ? undefined
          : "An idea, a problem or an open question. It starts as a draft."
      }
      onConfirm={submit}
      confirmLabel={item ? "Save Changes" : "Create Draft"}
      loading={create.isPending || update.isPending}
      disabled={!title.trim()}
      contentClassName="sm:max-w-2xl"
      asForm
    >
      <Field>
        <FieldLabel htmlFor="plan-title">Title</FieldLabel>
        <Input
          id="plan-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Money has nothing worth buying"
          maxLength={PLANNING_TITLE_MAX_LENGTH}
        />
      </Field>

      {item && (
        <Field>
          <FieldLabel htmlFor="plan-status">Status</FieldLabel>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as PlanningItemStatus)}
          >
            <SelectTrigger id="plan-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANNING_ITEM_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_CONFIG[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <CategoryFields
        idPrefix="plan"
        category={category}
        subcategoryId={subcategoryId}
        subcategories={subcategoriesQuery.data?.subcategories ?? []}
        onChange={(next) => {
          setCategory(next.category);
          setSubcategoryId(next.subcategoryId);
        }}
      />

      <MarkdownField
        id="plan-body"
        label="Description"
        value={body}
        onChange={setBody}
        rows={12}
        maxLength={PLANNING_TEXT_MAX_LENGTH}
        placeholder="What is the idea or the problem?"
      />

      {!item && (
        <Field>
          <FieldLabel>Assigned to</FieldLabel>
          <AssigneePicker value={assigneeIds} onChange={setAssigneeIds} />
        </Field>
      )}
    </FormDialog>
  );
}
