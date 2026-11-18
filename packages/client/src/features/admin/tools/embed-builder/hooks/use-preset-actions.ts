import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  ComponentNode,
  EmbedData,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";
import {
  normalizeLoadedEmbed,
  toExternalData,
  type ActivePreset,
} from "../embed-data";

interface UsePresetActionsOptions {
  activePreset: ActivePreset | null;
  setActivePreset: (preset: ActivePreset | null) => void;
  setSelectedCategoryId: (categoryId: number | null) => void;
  resetBuilder: () => void;
}

function invalidatePresetLists() {
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.list.pathFilter(),
  );
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.categories.list.pathFilter(),
  );
}

export function usePresetActions({
  activePreset,
  setActivePreset,
  setSelectedCategoryId,
  resetBuilder,
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
        onSuccess: () =>
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.categories.list.pathFilter(),
          ),
      }),
    ),
  );
  const updateCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.update.mutationOptions(
      useMutationToast({
        success: "Category updated",
        onSuccess: () =>
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.categories.list.pathFilter(),
          ),
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
          if (activePreset?.id === presetId) {
            setActivePreset({ ...activePreset, categoryId });
            setSelectedCategoryId(categoryId);
          }
        },
      }),
    ),
  );

  const handleDuplicatePreset = useCallback(
    async (preset: {
      id: number;
      name: string;
      kind?: PresetKind;
      data: unknown;
      categoryId?: number | null;
    }) => {
      const presetKind: PresetKind = preset.kind ?? "embed";
      const baseName = preset.name.replace(/ \(copy(?: \d+)?\)$/, "");
      let copyName = `${baseName} (copy)`;

      const existing = await queryClient.fetchQuery(
        trpc.admin.embeds.presets.list.queryOptions({
          search: baseName,
          limit: 50,
        }),
      );
      const copyNames = new Set(existing.presets.map((p) => p.name));
      if (copyNames.has(copyName)) {
        let n = 2;
        while (copyNames.has(`${baseName} (copy ${n})`)) n++;
        copyName = `${baseName} (copy ${n})`;
      }

      const payload: MessagePayload =
        presetKind === "components"
          ? {
              kind: "components",
              components: {
                components:
                  (preset.data as { components?: ComponentNode[] })
                    ?.components ?? [],
              },
            }
          : {
              kind: "embed",
              embed: toExternalData(
                normalizeLoadedEmbed(preset.data as EmbedData),
              ),
            };

      duplicatePresetMutation.mutate({
        name: copyName,
        categoryId: preset.categoryId ?? null,
        ...payload,
      });
    },
    [duplicatePresetMutation],
  );

  const handleDeletePreset = useCallback(
    async (id: number, name: string) => {
      try {
        await deletePresetMutation.mutateAsync({ id });
      } catch {
        return;
      }
      toast.success(`Preset "${name}" deleted`);
      if (activePreset?.id === id) {
        resetBuilder();
      }
      invalidatePresetLists();
    },
    [deletePresetMutation, activePreset, resetBuilder, toast],
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      try {
        return await createCategoryMutation.mutateAsync({ name });
      } catch {
        return null;
      }
    },
    [createCategoryMutation],
  );

  const handleUpdateCategory = useCallback(
    (id: number, updates: { name?: string; sortOrder?: number }) =>
      updateCategoryMutation.mutate({ id, ...updates }),
    [updateCategoryMutation],
  );

  const handleDeleteCategory = useCallback(
    async (id: number, name: string) => {
      try {
        await deleteCategoryMutation.mutateAsync({ id });
      } catch {
        return;
      }
      invalidatePresetLists();
      if (activePreset?.categoryId === id) {
        setActivePreset({ ...activePreset, categoryId: null });
        setSelectedCategoryId(null);
      }
      toast.success(`Category "${name}" deleted`);
    },
    [
      deleteCategoryMutation,
      activePreset,
      setActivePreset,
      setSelectedCategoryId,
      toast,
    ],
  );

  const handleSetPresetCategory = useCallback(
    (presetId: number, categoryId: number | null) =>
      setCategoryMutation.mutate({ presetId, categoryId }),
    [setCategoryMutation],
  );

  return {
    handleDuplicatePreset,
    handleDeletePreset,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleSetPresetCategory,
  };
}
