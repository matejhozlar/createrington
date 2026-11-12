import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { embedBotSchema } from "@createrington/shared/api/embed";
import type {
  EmbedData,
  EmbedBot,
  ComponentNode,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  clearDraft,
  hasPendingAssistantInsert,
  loadDraft,
  saveDraft,
} from "../draft";
import {
  DEFAULT_EMBED,
  normalizeLoadedEmbed,
  toExternalData,
  type ActivePreset,
  type EmbedDataInternal,
  type EmbedFieldInternal,
} from "../embed-data";
import { findPayloadIssue } from "../validation";
import { usePresetActions } from "./use-preset-actions";

export function useEmbedBuilder() {
  const toast = useToastActions();

  // Load any persisted draft once on mount and seed each piece of state
  // from it. Stored as state (not a ref) so the useState initializers
  // below can read it without triggering the "no ref reads during render"
  // rule. Never updated after mount: a ref further down handles the
  // one-shot "draft restored" toast.
  const [pendingDraft] = useState(loadDraft);
  const [kind, setKind] = useState<PresetKind>(
    () => pendingDraft?.kind ?? "embed",
  );
  const [data, setData] = useState<EmbedDataInternal>(() =>
    pendingDraft
      ? normalizeLoadedEmbed(pendingDraft.data)
      : { ...DEFAULT_EMBED },
  );
  const [components, setComponents] = useState<ComponentNode[]>(
    () => pendingDraft?.components ?? [],
  );
  const [bot, setBot] = useState<EmbedBot>(
    () => embedBotSchema.safeParse(pendingDraft?.bot).data ?? "main",
  );
  const [channelId, setChannelId] = useState(
    () => pendingDraft?.channelId ?? "",
  );
  const [activePreset, setActivePreset] = useState<ActivePreset | null>(
    () => pendingDraft?.activePreset ?? null,
  );
  const [presetName, setPresetName] = useState(
    () => pendingDraft?.presetName ?? "",
  );
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    () => pendingDraft?.selectedCategoryId ?? null,
  );

  const debouncedSearch = useDebouncedValue(search);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    () => pendingDraft?.savedSnapshot ?? "",
  );

  const externalData = useMemo(() => toExternalData(data), [data]);

  const currentPayload = useMemo<MessagePayload>(
    () =>
      kind === "components"
        ? { kind: "components", components: { components } }
        : { kind: "embed", embed: externalData },
    [kind, components, externalData],
  );

  const serializedData = useMemo(
    () =>
      JSON.stringify(
        currentPayload.kind === "components"
          ? currentPayload.components
          : currentPayload.embed,
      ),
    [currentPayload],
  );

  const isDirty = useMemo(() => {
    if (!activePreset) return false;
    return serializedData !== lastSavedSnapshot;
  }, [serializedData, activePreset, lastSavedSnapshot]);

  const hasContent =
    kind === "components"
      ? components.length > 0
      : !!(
          data.content ||
          data.title ||
          data.description ||
          data.fields.length > 0
        );

  const draftToastedRef = useRef(false);
  useEffect(() => {
    if (!pendingDraft || draftToastedRef.current) return;
    draftToastedRef.current = true;
    if (hasPendingAssistantInsert()) return;
    toast.info("Draft restored from your last session");
  }, [pendingDraft, toast]);

  // Auto-save draft to localStorage (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (hasContent || activePreset) {
        saveDraft({
          kind,
          data: toExternalData(data),
          components,
          presetName,
          bot,
          channelId,
          activePreset,
          selectedCategoryId,
          savedSnapshot: lastSavedSnapshot,
        });
      } else {
        clearDraft();
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [
    kind,
    data,
    components,
    presetName,
    bot,
    channelId,
    activePreset,
    selectedCategoryId,
    hasContent,
    lastSavedSnapshot,
  ]);

  const categoriesQuery = useQuery(
    trpc.admin.embeds.presets.categories.list.queryOptions(),
  );

  const presetsQuery = useQuery(
    trpc.admin.embeds.presets.list.queryOptions(
      { search: debouncedSearch || undefined, limit: 50 },
      { enabled: !!debouncedSearch },
    ),
  );

  const linksQuery = useQuery(
    trpc.admin.embeds.presets.links.list.queryOptions(
      { presetId: activePreset?.id ?? 0 },
      { enabled: !!activePreset },
    ),
  );

  const channelsQuery = useQuery(trpc.admin.embeds.channels.queryOptions());

  const channelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of channelsQuery.data ?? []) {
      for (const ch of group.channels) {
        map.set(ch.id, ch.name);
      }
    }
    return map;
  }, [channelsQuery.data]);

  const sendEmbed = useMutation(trpc.admin.embeds.send.mutationOptions());
  const createPreset = useMutation(
    trpc.admin.embeds.presets.create.mutationOptions(),
  );
  const updatePreset = useMutation(
    trpc.admin.embeds.presets.update.mutationOptions(),
  );
  const unlinkMutation = useMutation(
    trpc.admin.embeds.presets.links.delete.mutationOptions(),
  );
  const updateAllMutation = useMutation(
    trpc.admin.embeds.updateAll.mutationOptions(),
  );
  const updateLinkMutation = useMutation(
    trpc.admin.embeds.updateLink.mutationOptions(),
  );

  const isPending =
    sendEmbed.isPending || createPreset.isPending || updatePreset.isPending;

  const setEmbedData = useCallback(
    (updater: EmbedData | ((prev: EmbedData) => EmbedData)) => {
      setData((prev) => {
        const prevExternal = toExternalData(prev);
        const next =
          typeof updater === "function" ? updater(prevExternal) : updater;
        // Preserve _ids on fields that match by index (for edits that don't change field count)
        const fields: EmbedFieldInternal[] = next.fields.map((f, i) => {
          const existing = prev.fields[i];
          if (
            existing &&
            existing.name === f.name &&
            existing.value === f.value &&
            existing.inline === f.inline
          ) {
            return existing;
          }
          return {
            ...f,
            _id:
              (f as EmbedFieldInternal)._id ??
              existing?._id ??
              crypto.randomUUID(),
          };
        });
        return { ...next, fields };
      });
    },
    [],
  );

  const handleSend = useCallback(
    async (opts?: { linkToPreset?: boolean }): Promise<boolean> => {
      if (!channelId) {
        toast.error("Please select a target channel");
        return false;
      }
      if (!hasContent) {
        toast.error(
          kind === "components"
            ? "Add at least one component"
            : "Message must have content, a title, a description, or at least one field",
        );
        return false;
      }

      const issue = findPayloadIssue(kind, data.fields, components);
      if (issue) {
        toast.error(issue);
        return false;
      }

      const shouldLink = opts?.linkToPreset ?? true;
      const hasActionButtons =
        kind === "embed" &&
        !!data.actionButtons &&
        data.actionButtons.length > 0;

      if (hasActionButtons && !activePreset) {
        toast.error(
          "Save as a preset first — action buttons need a preset to function.",
        );
        return false;
      }

      // Action buttons always need the presetId to encode in their custom ID
      const presetId = hasActionButtons
        ? activePreset!.id
        : shouldLink
          ? activePreset?.id
          : undefined;

      try {
        const result = await sendEmbed.mutateAsync({
          channelId,
          presetId,
          bot,
          ...currentPayload,
        });
        if (activePreset && shouldLink)
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.links.list.pathFilter(),
          );
        toast.success(
          `${kind === "components" ? "Message" : "Embed"} sent${result.messageId ? ` (${result.messageId})` : ""}`,
        );
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send");
        return false;
      }
    },
    [
      channelId,
      hasContent,
      kind,
      data,
      currentPayload,
      activePreset,
      bot,
      sendEmbed,
      toast,
      components,
    ],
  );

  const handleSave = useCallback(
    async (opts?: {
      name?: string;
      categoryId?: number | null;
    }): Promise<boolean> => {
      const issue = findPayloadIssue(kind, data.fields, components);
      if (issue) {
        toast.error(issue);
        return false;
      }

      if (activePreset) {
        try {
          const updates: {
            id: number;
            name?: string;
            payload: MessagePayload;
          } = {
            id: activePreset.id,
            payload: currentPayload,
          };
          if (presetName.trim() && presetName.trim() !== activePreset.name) {
            updates.name = presetName.trim();
          }
          await updatePreset.mutateAsync(updates);
          setLastSavedSnapshot(serializedData);
          clearDraft();
          if (updates.name) {
            setActivePreset({
              ...activePreset,
              name: updates.name,
              categoryId: activePreset.categoryId,
            });
          }
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.list.pathFilter(),
          );
          toast.success(
            `Preset "${updates.name ?? activePreset.name}" updated`,
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to update preset",
          );
          return false;
        }
      } else {
        const name = (opts?.name ?? presetName).trim();
        const categoryId =
          opts?.categoryId !== undefined ? opts.categoryId : selectedCategoryId;
        if (!name) {
          toast.error("Enter a preset name to save");
          return false;
        }
        try {
          const created = await createPreset.mutateAsync({
            name,
            categoryId,
            ...currentPayload,
          });
          setLastSavedSnapshot(serializedData);
          clearDraft();
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.categories.list.pathFilter(),
          );
          setActivePreset({
            id: created.id,
            name: created.name,
            categoryId: created.categoryId ?? null,
          });
          setPresetName(created.name);
          setSelectedCategoryId(created.categoryId ?? null);
          toast.success(`Preset "${name}" created`);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to save preset",
          );
          return false;
        }
      }
    },
    [
      kind,
      data,
      components,
      currentPayload,
      serializedData,
      activePreset,
      presetName,
      selectedCategoryId,
      updatePreset,
      createPreset,
      toast,
    ],
  );

  const handleLoadPreset = useCallback(
    (preset: {
      id: number;
      name: string;
      kind?: PresetKind;
      data: unknown;
      categoryId?: number | null;
    }) => {
      const presetKind: PresetKind = preset.kind ?? "embed";
      if (presetKind === "components") {
        const loaded =
          (preset.data as { components?: ComponentNode[] })?.components ?? [];
        setKind("components");
        setComponents(loaded);
        setData({ ...DEFAULT_EMBED });
        setLastSavedSnapshot(JSON.stringify({ components: loaded }));
      } else {
        const normalized = normalizeLoadedEmbed(preset.data as EmbedData);
        setKind("embed");
        setComponents([]);
        setData(normalized);
        setLastSavedSnapshot(JSON.stringify(toExternalData(normalized)));
      }
      setActivePreset({
        id: preset.id,
        name: preset.name,
        categoryId: preset.categoryId ?? null,
      });
      setPresetName(preset.name);
      setSelectedCategoryId(preset.categoryId ?? null);
      toast.success(`Loaded "${preset.name}"`);
    },
    [toast],
  );

  const detachPreset = useCallback(() => {
    setActivePreset(null);
    setPresetName("");
    setSelectedCategoryId(null);
    setLastSavedSnapshot("");
  }, []);

  const handleImportEmbed = useCallback(
    (embed: Partial<EmbedData>) => {
      setKind("embed");
      setComponents([]);
      setData(normalizeLoadedEmbed(embed));
      detachPreset();
    },
    [detachPreset],
  );

  const handleImportComponents = useCallback(
    (nodes: ComponentNode[]) => {
      setKind("components");
      setData({ ...DEFAULT_EMBED });
      setComponents(nodes);
      detachPreset();
    },
    [detachPreset],
  );

  const handleNewEmbed = useCallback(() => {
    setKind("embed");
    setData({ ...DEFAULT_EMBED });
    setComponents([]);
    setActivePreset(null);
    setPresetName("");
    setChannelId("");
    setSelectedCategoryId(null);
    setLastSavedSnapshot("");
    clearDraft();
  }, []);

  const handleUpdateAll = useCallback(async (): Promise<boolean> => {
    if (!activePreset) return false;

    const issue = findPayloadIssue(kind, data.fields, components);
    if (issue) {
      toast.error(issue);
      return false;
    }

    try {
      const result = await updateAllMutation.mutateAsync({
        presetId: activePreset.id,
        bot,
        ...currentPayload,
      });
      setLastSavedSnapshot(serializedData);
      if (result.failed > 0) {
        toast.warning(
          `Updated ${result.updated}, failed ${result.failed}`,
          "Partial update",
        );
      } else {
        toast.success(
          `Updated ${result.updated} linked message${result.updated === 1 ? "" : "s"}`,
        );
      }
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update all",
      );
      return false;
    }
  }, [
    activePreset,
    kind,
    data,
    components,
    currentPayload,
    serializedData,
    bot,
    updateAllMutation,
    toast,
  ]);

  const handleUpdateLink = useCallback(
    async (linkId: number) => {
      const issue = findPayloadIssue(kind, data.fields, components);
      if (issue) {
        toast.error(issue);
        return;
      }
      try {
        await updateLinkMutation.mutateAsync({
          linkId,
          bot,
          ...currentPayload,
        });
        toast.success("Linked message updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update message",
        );
      }
    },
    [kind, data, components, currentPayload, bot, updateLinkMutation, toast],
  );

  const handleUnlink = useCallback(
    async (linkId: number) => {
      try {
        await unlinkMutation.mutateAsync({ id: linkId });
        void queryClient.invalidateQueries(
          trpc.admin.embeds.presets.links.list.pathFilter(),
        );
        toast.success("Message unlinked");
      } catch {
        toast.error("Failed to unlink message");
      }
    },
    [unlinkMutation, toast],
  );

  const presetActions = usePresetActions({
    activePreset,
    setActivePreset,
    setSelectedCategoryId,
    resetBuilder: handleNewEmbed,
    createPreset: createPreset.mutateAsync,
  });

  return {
    // State
    kind,
    setKind,
    components,
    setComponents,
    data,
    externalData,
    setEmbedData,
    bot,
    setBot,
    channelId,
    setChannelId,
    activePreset,
    presetName,
    setPresetName,
    search,
    setSearch,
    selectedCategoryId,
    setSelectedCategoryId,
    isDirty,
    hasContent,
    isPending,

    // Queries
    categoriesQuery,
    presetsQuery,
    linksQuery,
    channelMap,

    // Handlers
    handleSend,
    handleSave,
    handleLoadPreset,
    handleNewEmbed,
    handleImportEmbed,
    handleImportComponents,
    handleUpdateAll,
    handleUpdateLink,
    handleUnlink,
    ...presetActions,

    // Mutation state
    updateAllPending: updateAllMutation.isPending,
    updateLinkPending: updateLinkMutation.isPending,
  };
}

export type UseEmbedBuilder = ReturnType<typeof useEmbedBuilder>;
