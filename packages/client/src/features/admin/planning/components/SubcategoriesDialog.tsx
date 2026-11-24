import { useMutation } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { pluralize } from "@/lib/format";
import { queryClient, trpc } from "@/lib/trpc";
import {
  PLANNING_CATEGORIES,
  PLANNING_SUBCATEGORY_NAME_MAX_LENGTH,
  type PlanningCategory,
} from "@createrington/shared/planning";
import { CATEGORY_CONFIG } from "@/features/admin/planning/constants";
import type { PlanningSubcategory } from "@/features/admin/planning/types";
import { useDialogDraft } from "@/hooks/use-dialog-draft";

interface SubcategoriesDialogProps {
  open: boolean;
  onClose: () => void;
  defaultCategory: PlanningCategory;
  subcategories: PlanningSubcategory[];
}

export function SubcategoriesDialog({
  open,
  onClose,
  defaultCategory,
  subcategories,
}: SubcategoriesDialogProps) {
  const [draft, update] = useDialogDraft<{
    category: PlanningCategory;
    newName: string;
    editing: { id: number; name: string } | null;
    deleting: PlanningSubcategory | null;
  }>(open, () => ({
    category: defaultCategory,
    newName: "",
    editing: null,
    deleting: null,
  }));
  const { category, newName, editing, deleting } = draft;

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.admin.planning.pathFilter());

  const create = useMutation(
    trpc.admin.planning.subcategories.create.mutationOptions(
      useMutationToast({
        onSuccess: () => {
          void invalidate();
          update({ newName: "" });
        },
      }),
    ),
  );
  const rename = useMutation(
    trpc.admin.planning.subcategories.update.mutationOptions(
      useMutationToast({
        onSuccess: () => {
          void invalidate();
          update({ editing: null });
        },
      }),
    ),
  );
  const remove = useMutation(
    trpc.admin.planning.subcategories.delete.mutationOptions(
      useMutationToast({
        success: "Subcategory deleted",
        onSuccess: () => void invalidate(),
      }),
    ),
  );

  const rows = subcategories.filter((s) => s.category === category);
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subcategories</DialogTitle>
          <DialogDescription>
            The sections inside each category. Deleting one keeps its plans in
            the category.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={category}
          onValueChange={(value) => {
            update({ category: value as PlanningCategory });
            update({ editing: null });
          }}
        >
          <TabsList className="text-foreground/80">
            {PLANNING_CATEGORIES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {CATEGORY_CONFIG[value].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ul className="flex flex-col gap-1">
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No subcategories yet.
            </li>
          )}
          {rows.map((subcategory) =>
            editing?.id === subcategory.id ? (
              <li key={subcategory.id}>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editing.name.trim()) rename.mutate(editing);
                  }}
                >
                  <Input
                    value={editing.name}
                    onChange={(event) =>
                      update({
                        editing: { id: editing.id, name: event.target.value },
                      })
                    }
                    aria-label="Subcategory name"
                    maxLength={PLANNING_SUBCATEGORY_NAME_MAX_LENGTH}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Save name"
                    disabled={!editing.name.trim()}
                    loading={rename.isPending}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancel rename"
                    onClick={() => update({ editing: null })}
                  >
                    <X className="size-4" />
                  </Button>
                </form>
              </li>
            ) : (
              <li
                key={subcategory.id}
                className="flex h-9 items-center gap-2 pl-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {subcategory.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {pluralize(subcategory.itemCount, "plan")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rename ${subcategory.name}`}
                  onClick={() =>
                    update({
                      editing: { id: subcategory.id, name: subcategory.name },
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${subcategory.name}`}
                  onClick={() => update({ deleting: subcategory })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ),
          )}
        </ul>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (newName.trim()) create.mutate({ category, name: newName });
          }}
        >
          <Input
            value={newName}
            onChange={(event) => update({ newName: event.target.value })}
            placeholder={`New ${CATEGORY_CONFIG[category].label} subcategory`}
            aria-label="New subcategory name"
            maxLength={PLANNING_SUBCATEGORY_NAME_MAX_LENGTH}
          />
          <Button
            type="submit"
            disabled={!newName.trim()}
            loading={create.isPending}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </form>

        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) update({ deleting: null });
          }}
          title="Delete Subcategory"
          description={
            deleting && (
              <>
                Delete <span className="font-semibold">{deleting.name}</span>?{" "}
                {pluralize(deleting.itemCount, "plan")} will lose this
                subcategory.
              </>
            )
          }
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() =>
            deleting ? remove.mutateAsync({ id: deleting.id }) : undefined
          }
        />
      </DialogContent>
    </Dialog>
  );
}
