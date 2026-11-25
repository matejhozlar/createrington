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
import { STATUS_CONFIG } from "@/features/admin/planning/constants";
import type { PlanningItemDetail } from "@/features/admin/planning/types";
import { AssigneePicker } from "./AssigneePicker";
import { CategoryFields } from "./CategoryFields";
import { MarkdownField } from "./MarkdownField";
import { useDialogDraft } from "@/hooks/use-dialog-draft";

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
  const [draft, update] = useDialogDraft<{
    title: string;
    body: string;
    categories: PlanningCategory[];
    subcategoryIds: number[];
    status: PlanningItemStatus;
    assigneeIds: string[];
    revision: number | undefined;
  }>(open, () => ({
    title: item?.title ?? "",
    body: item?.body ?? "",
    categories: item?.categories ?? [defaultCategory],
    subcategoryIds: item?.subcategoryIds ?? [],
    status: item?.status ?? "draft",
    assigneeIds: [],
    revision: item?.revision,
  }));
  const {
    title,
    body,
    categories,
    subcategoryIds,
    status,
    assigneeIds,
    revision,
  } = draft;

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

  const updateItem = useMutation(
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
      updateItem.mutate({
        id: item.id,
        revision,
        title,
        body,
        categories,
        subcategoryIds,
        status,
      });
      return;
    }
    create.mutate({ title, body, categories, subcategoryIds, assigneeIds });
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
      loading={create.isPending || updateItem.isPending}
      disabled={!title.trim()}
      contentClassName="sm:max-w-2xl"
      asForm
    >
      <Field>
        <FieldLabel htmlFor="plan-title">Title</FieldLabel>
        <Input
          id="plan-title"
          value={title}
          onChange={(event) => update({ title: event.target.value })}
          placeholder="e.g. Money has nothing worth buying"
          maxLength={PLANNING_TITLE_MAX_LENGTH}
        />
      </Field>

      {item && (
        <Field>
          <FieldLabel htmlFor="plan-status">Status</FieldLabel>
          <Select
            value={status}
            onValueChange={(value) =>
              update({ status: value as PlanningItemStatus })
            }
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
        categories={categories}
        subcategoryIds={subcategoryIds}
        subcategories={subcategoriesQuery.data?.subcategories ?? []}
        onChange={update}
      />

      <MarkdownField
        id="plan-body"
        label="Description"
        value={body}
        onChange={(value: string) => update({ body: value })}
        rows={12}
        maxLength={PLANNING_TEXT_MAX_LENGTH}
        placeholder="What is the idea or the problem?"
      />

      {!item && (
        <Field>
          <FieldLabel>Assigned to</FieldLabel>
          <AssigneePicker
            value={assigneeIds}
            onChange={(value: string[]) => update({ assigneeIds: value })}
          />
        </Field>
      )}
    </FormDialog>
  );
}
