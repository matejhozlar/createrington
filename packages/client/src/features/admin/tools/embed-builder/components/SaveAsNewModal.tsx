import { useMemo, useState } from "react";
import { FolderPlus, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

const NEW_CATEGORY_VALUE = "__new__";
const UNCATEGORIZED_VALUE = "__none__";

interface SaveAsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  builder: UseEmbedBuilder;
}

export function SaveAsNewModal({
  open,
  onOpenChange,
  builder,
}: SaveAsNewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as new preset</DialogTitle>
          <DialogDescription>
            Give your preset a name and choose where to file it.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <SaveAsNewForm
            builder={builder}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SaveAsNewFormProps {
  builder: UseEmbedBuilder;
  onClose: () => void;
}

function SaveAsNewForm({ builder, onClose }: SaveAsNewFormProps) {
  const {
    presetName,
    selectedCategoryId,
    categoriesQuery,
    handleSave,
    handleCreateCategory,
    isPending,
  } = builder;

  const categories = categoriesQuery.data ?? [];

  const [name, setName] = useState(presetName);
  const [categoryValue, setCategoryValue] = useState<string>(
    selectedCategoryId ? String(selectedCategoryId) : UNCATEGORIZED_VALUE,
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creating, setCreating] = useState(false);

  const isCreatingNew = categoryValue === NEW_CATEGORY_VALUE;
  const trimmedName = name.trim();
  const trimmedNewCategory = newCategoryName.trim();

  const submitDisabled = useMemo(() => {
    if (isPending || creating) return true;
    if (!trimmedName) return true;
    if (isCreatingNew && !trimmedNewCategory) return true;
    return false;
  }, [isPending, creating, trimmedName, isCreatingNew, trimmedNewCategory]);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (submitDisabled) return;

    let categoryId: number | null = null;
    if (isCreatingNew) {
      setCreating(true);
      const created = await handleCreateCategory(trimmedNewCategory);
      setCreating(false);
      if (!created) return;
      categoryId = created.id;
    } else if (categoryValue !== UNCATEGORIZED_VALUE) {
      categoryId = Number(categoryValue);
    }

    if (await handleSave({ name: trimmedName, categoryId })) onClose();
  }

  return (
    <>
      <form
        id="save-as-new-form"
        onSubmit={onSubmit}
        className="space-y-4 py-2"
      >
        <Field>
          <FieldLabel htmlFor="preset-name">Preset name</FieldLabel>
          <Input
            id="preset-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome message"
            maxLength={100}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="preset-category">Category</FieldLabel>
          <Select value={categoryValue} onValueChange={setCategoryValue}>
            <SelectTrigger id="preset-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_CATEGORY_VALUE}>
                <span className="inline-flex items-center gap-1.5">
                  <FolderPlus className="size-3.5" />
                  Create new category…
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {isCreatingNew && (
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              maxLength={50}
            />
          )}
        </Field>
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="save-as-new-form"
          disabled={submitDisabled}
          loading={isPending || creating}
        >
          <Save className="mr-1.5 size-4" />
          Save preset
        </Button>
      </DialogFooter>
    </>
  );
}
