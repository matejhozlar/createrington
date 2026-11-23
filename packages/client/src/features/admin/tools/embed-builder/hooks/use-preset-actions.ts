import { useMutation } from "@tanstack/react-query";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";
import type { ActivePreset } from "@/features/admin/tools/embed-builder/builder-state";
import { parsePayload } from "@/features/admin/tools/embed-builder/payload";
import type { PresetRow } from "@/features/admin/tools/embed-builder/preset-row";

interface UsePresetActionsOptions {
  activePreset: ActivePreset | null;
  onActivePresetMoved: (categoryId: number | null) => void;
  onActivePresetDeleted: () => void;
}

function invalidatePresetLists() {
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.list.pathFilter(),
  );
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.categories.list.pathFilter(),
  );
}

function invalidateCategories() {
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.categories.list.pathFilter(),
  );
}

async function nextCopyName(name: string): Promise<string> {
  const baseName = name.replace(/ \(copy(?: \d+)?\)$/, "");
  const existing = await queryClient.fetchQuery(
    trpc.admin.embeds.presets.list.queryOptions({
      search: baseName,
      limit: 50,
    }),
  );
  const taken = new Set(existing.items.map((p) => p.name));
  if (!taken.has(`${baseName} (copy)`)) return `${baseName} (copy)`;
  let n = 2;
  while (taken.has(`${baseName} (copy ${n})`)) n++;
  return `${baseName} (copy ${n})`;
}

export function usePresetActions({
  activePreset,
  onActivePresetMoved,
  onActivePresetDeleted,
}: UsePresetActionsOptions) {
  const toast = useToastActions();

  const duplicatePresetMutation = useMutation(
    trpc.admin.embeds.presets.create.mutationOptions(
      useMutationToast({
        success: (created) => `Duplicated as "${created.name}"`,
        onSuccess: invalidatePresetLists,
      }),
    ),
  );
  const deletePresetMutation = useMutation(
    trpc.admin.embeds.presets.delete.mutationOptions(useMutationToast()),
  );
  const createCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.create.mutationOptions(
      useMutationToast({
        success: (_, variables) => `Category "${variables.name}" created`,
        onSuccess: invalidateCategories,
      }),
    ),
  );
  const updateCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.update.mutationOptions(
      useMutationToast({
        success: "Category updated",
        onSuccess: invalidateCategories,
      }),
    ),
  );
  const deleteCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.delete.mutationOptions(
      useMutationToast(),
    ),
  );
  const setCategoryMutation = useMutation(
    trpc.admin.embeds.presets.setCategory.mutationOptions(
      useMutationToast({
        success: "Preset moved",
        onSuccess: (_, { presetId, categoryId }) => {
          invalidatePresetLists();
          if (activePreset?.id === presetId) onActivePresetMoved(categoryId);
        },
      }),
    ),
  );

  const handleDuplicatePreset = async (preset: PresetRow) => {
    const payload = parsePayload(preset.kind, preset.data);
    if (!payload) {
      toast.error(`"${preset.name}" holds a message the builder cannot read`);
      return;
    }
    duplicatePresetMutation.mutate({
      name: await nextCopyName(preset.name),
      categoryId: preset.categoryId,
      ...payload,
    });
  };

  const handleDeletePreset = async (id: number, name: string) => {
    await deletePresetMutation.mutateAsync({ id });
    toast.success(`Preset "${name}" deleted`);
    if (activePreset?.id === id) onActivePresetDeleted();
    invalidatePresetLists();
  };

  const handleCreateCategory = async (name: string) => {
    try {
      return await createCategoryMutation.mutateAsync({ name });
    } catch {
      return null;
    }
  };

  const handleUpdateCategory = (id: number, name: string) =>
    updateCategoryMutation.mutateAsync({ id, name });

  const handleDeleteCategory = async (id: number, name: string) => {
    await deleteCategoryMutation.mutateAsync({ id });
    invalidatePresetLists();
    if (activePreset?.categoryId === id) onActivePresetMoved(null);
    toast.success(`Category "${name}" deleted`);
  };

  const handleSetPresetCategory = (
    presetId: number,
    categoryId: number | null,
  ) => setCategoryMutation.mutate({ presetId, categoryId });

  return {
    handleDuplicatePreset,
    handleDeletePreset,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleSetPresetCategory,
  };
}

export type PresetActions = ReturnType<typeof usePresetActions>;
