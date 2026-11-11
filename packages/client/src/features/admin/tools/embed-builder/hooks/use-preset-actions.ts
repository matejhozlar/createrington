import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  ComponentNode,
  EmbedData,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, queryClient, type RouterInput } from "@/lib/trpc";
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
  createPreset: (
    input: RouterInput["admin"]["embeds"]["presets"]["create"],
  ) => Promise<unknown>;
}

export function usePresetActions({
  activePreset,
  setActivePreset,
  setSelectedCategoryId,
  resetBuilder,
  createPreset,
}: UsePresetActionsOptions) {
  const toast = useToastActions();

  const deletePresetMutation = useMutation(
    trpc.admin.embeds.presets.delete.mutationOptions(),
  );
  const createCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.create.mutationOptions(),
  );
  const updateCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.update.mutationOptions(),
  );
  const deleteCategoryMutation = useMutation(
    trpc.admin.embeds.presets.categories.delete.mutationOptions(),
  );
  const setCategoryMutation = useMutation(
    trpc.admin.embeds.presets.setCategory.mutationOptions(),
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

      // Check for existing copies and increment
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

      try {
        await createPreset({
          name: copyName,
          categoryId: preset.categoryId ?? null,
          ...payload,
        });
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.list.pathFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.categories.list.pathFilter(),
        );
        toast.success(`Duplicated as "${copyName}"`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to duplicate preset",
        );
      }
    },
    [createPreset, toast],
  );

  const handleDeletePreset = useCallback(
    async (id: number, name: string) => {
      try {
        await deletePresetMutation.mutateAsync({ id });
        toast.success(`Preset "${name}" deleted`);
        if (activePreset?.id === id) {
          resetBuilder();
        }
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.list.pathFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.categories.list.pathFilter(),
        );
      } catch {
        toast.error("Failed to delete preset");
      }
    },
    [deletePresetMutation, activePreset, resetBuilder, toast],
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      try {
        const created = await createCategoryMutation.mutateAsync({ name });
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.categories.list.pathFilter(),
        );
        toast.success(`Category "${name}" created`);
        return created;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create category",
        );
        return null;
      }
    },
    [createCategoryMutation, toast],
  );

  const handleUpdateCategory = useCallback(
    async (id: number, updates: { name?: string; sortOrder?: number }) => {
      try {
        await updateCategoryMutation.mutateAsync({ id, ...updates });
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.categories.list.pathFilter(),
        );
        toast.success("Category updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update category",
        );
      }
    },
    [updateCategoryMutation, toast],
  );

  const handleDeleteCategory = useCallback(
    async (id: number, name: string) => {
      try {
        await deleteCategoryMutation.mutateAsync({ id });
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.categories.list.pathFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.list.pathFilter(),
        );
        if (activePreset?.categoryId === id) {
          setActivePreset({ ...activePreset, categoryId: null });
          setSelectedCategoryId(null);
        }
        toast.success(`Category "${name}" deleted`);
      } catch {
        toast.error("Failed to delete category");
      }
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
    async (presetId: number, categoryId: number | null) => {
      try {
        await setCategoryMutation.mutateAsync({ presetId, categoryId });
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.list.pathFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.categories.list.pathFilter(),
        );
        if (activePreset?.id === presetId) {
          setActivePreset({ ...activePreset, categoryId });
          setSelectedCategoryId(categoryId);
        }
        toast.success("Preset moved");
      } catch {
        toast.error("Failed to move preset");
      }
    },
    [
      setCategoryMutation,
      activePreset,
      setActivePreset,
      setSelectedCategoryId,
      toast,
    ],
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
