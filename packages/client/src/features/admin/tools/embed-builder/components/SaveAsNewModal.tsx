import { useState } from "react";
import { FolderPlus, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { trpc } from "@/lib/trpc";
import { EMBED_PRESET_NAME_MAX } from "@createrington/shared/api/embed";
import type { UseEmbedBuilder } from "@/features/admin/tools/embed-builder/hooks/use-embed-builder";

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
  const { state, handleSave, isPending, presetActions } = builder;
  const categoriesQuery = useQuery(
    trpc.admin.embeds.presets.categories.list.queryOptions(),
  );
  const categories = categoriesQuery.data ?? [];

  const [name, setName] = useState("");
  const [categoryValue, setCategoryValue] = useState(UNCATEGORIZED_VALUE);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creating, setCreating] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(state.presetName);
      setCategoryValue(
        state.selectedCategoryId
          ? String(state.selectedCategoryId)
          : UNCATEGORIZED_VALUE,
      );
      setNewCategoryName("");
    }
  }

  const isCreatingNew = categoryValue === NEW_CATEGORY_VALUE;
  const trimmedName = name.trim();
  const trimmedNewCategory = newCategoryName.trim();

  async function onSubmit() {
    let categoryId: number | null = null;
    if (isCreatingNew) {
      setCreating(true);
      const created =
        await presetActions.handleCreateCategory(trimmedNewCategory);
      setCreating(false);
      if (!created) return;
      categoryId = created.id;
    } else if (categoryValue !== UNCATEGORIZED_VALUE) {
      categoryId = Number(categoryValue);
    }

    if (await handleSave({ name: trimmedName, categoryId })) {
      onOpenChange(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Save as new preset"
      description="Give your preset a name and choose where to file it."
      confirmLabel={
        <>
          <Save className="mr-1.5 size-4" />
          Save preset
        </>
      }
      asForm
      loading={isPending || creating}
      disabled={!trimmedName || (isCreatingNew && !trimmedNewCategory)}
      onConfirm={() => void onSubmit()}
    >
      <Field>
        <FieldLabel htmlFor="preset-name">Preset name</FieldLabel>
        <Input
          id="preset-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Welcome message"
          maxLength={EMBED_PRESET_NAME_MAX}
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
    </FormDialog>
  );
}
