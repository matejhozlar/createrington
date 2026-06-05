import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type {
  EmbedData,
  EmbedBot,
  EmbedField,
  ComponentNode,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";

export interface EmbedFieldInternal extends EmbedField {
  _id: string;
}

export interface EmbedDataInternal extends Omit<EmbedData, "fields"> {
  fields: EmbedFieldInternal[];
}

export interface ActivePreset {
  id: number;
  name: string;
  categoryId: number | null;
}

const DEFAULT_EMBED: EmbedDataInternal = {
  content: undefined,
  title: undefined,
  description: undefined,
  color: undefined,
  url: undefined,
  fields: [],
  footer: undefined,
  author: undefined,
  authorUrl: undefined,
  authorIconUrl: undefined,
  thumbnailUrl: undefined,
  imageUrl: undefined,
  timestamp: false,
  buttons: [],
  actionButtons: [],
};

function assignFieldIds(fields: EmbedField[]): EmbedFieldInternal[] {
  return fields.map((f) => ({ ...f, _id: crypto.randomUUID() }));
}

function stripFieldIds(fields: EmbedFieldInternal[]): EmbedField[] {
  return fields.map((f) => ({
    name: f.name,
    value: f.value,
    inline: f.inline,
  }));
}

function toExternalData(data: EmbedDataInternal): EmbedData {
  return { ...data, fields: stripFieldIds(data.fields) };
}

function getIncompleteFieldIndexes(fields: { name: string; value: string }[]) {
  const out: number[] = [];
  fields.forEach((f, i) => {
    if (!f.name.trim() || !f.value.trim()) out.push(i);
  });
  return out;
}

function incompleteFieldsMessage(indexes: number[]): string {
  const list = indexes.map((i) => `#${i + 1}`).join(", ");
  return indexes.length === 1
    ? `Field ${list} is empty. Fill in both name and value, or remove it.`
    : `Fields ${list} are empty. Fill in both name and value, or remove them.`;
}

const DRAFT_KEY = "embed-builder-draft";

interface DraftState {
  kind: PresetKind;
  data: EmbedData;
  components: ComponentNode[];
  presetName: string;
  bot: EmbedBot;
  channelId: string;
  activePreset: ActivePreset | null;
  selectedCategoryId: number | null;
}

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(state: DraftState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable, silently ignore
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Silently ignore
  }
}

function normalizeLoadedEmbed(loaded: EmbedData): EmbedDataInternal {
  const raw = loaded as Record<string, unknown>;

  const footer =
    raw.footer && typeof raw.footer === "object" && "text" in raw.footer
      ? (raw.footer as { text: string }).text
      : (loaded.footer as string | undefined);

  const author =
    raw.author && typeof raw.author === "object" && "name" in raw.author
      ? (raw.author as { name: string }).name
      : (loaded.author as string | undefined);

  const authorUrl =
    raw.author && typeof raw.author === "object" && "url" in raw.author
      ? ((raw.author as { url?: string }).url ?? loaded.authorUrl)
      : loaded.authorUrl;

  const authorIconUrl =
    raw.author && typeof raw.author === "object" && "icon_url" in raw.author
      ? ((raw.author as { icon_url?: string }).icon_url ?? loaded.authorIconUrl)
      : loaded.authorIconUrl;

  return {
    ...DEFAULT_EMBED,
    ...loaded,
    footer,
    author,
    authorUrl,
    authorIconUrl,
    fields: assignFieldIds(loaded.fields ?? []),
  };
}

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
  const [bot, setBot] = useState<EmbedBot>(() => pendingDraft?.bot ?? "main");
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

  const debouncedSearch = useDebouncedValue(search, 300);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => {
    if (!pendingDraft?.activePreset) return "";
    return pendingDraft.kind === "components"
      ? JSON.stringify({ components: pendingDraft.components })
      : JSON.stringify(pendingDraft.data);
  });

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
    if (pendingDraft && !draftToastedRef.current) {
      draftToastedRef.current = true;
      toast.info("Draft restored from your last session");
    }
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
  ]);

  const utils = trpc.useUtils();

  const categoriesQuery = trpc.admin.embeds.presets.categories.list.useQuery();

  const presetsQuery = trpc.admin.embeds.presets.list.useQuery(
    { search: debouncedSearch || undefined, limit: 50 },
    { enabled: !!debouncedSearch },
  );

  const linksQuery = trpc.admin.embeds.presets.links.list.useQuery(
    { presetId: activePreset?.id ?? 0 },
    { enabled: !!activePreset },
  );

  const channelsQuery = trpc.admin.embeds.channels.useQuery();

  const channelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of channelsQuery.data ?? []) {
      for (const ch of group.channels) {
        map.set(ch.id, ch.name);
      }
    }
    return map;
  }, [channelsQuery.data]);

  const sendEmbed = trpc.admin.embeds.send.useMutation();
  const createPreset = trpc.admin.embeds.presets.create.useMutation();
  const updatePreset = trpc.admin.embeds.presets.update.useMutation();
  const deletePresetMutation = trpc.admin.embeds.presets.delete.useMutation();
  const unlinkMutation = trpc.admin.embeds.presets.links.delete.useMutation();
  const updateAllMutation = trpc.admin.embeds.updateAll.useMutation();
  const updateLinkMutation = trpc.admin.embeds.updateLink.useMutation();

  const createCategoryMutation =
    trpc.admin.embeds.presets.categories.create.useMutation();
  const updateCategoryMutation =
    trpc.admin.embeds.presets.categories.update.useMutation();
  const deleteCategoryMutation =
    trpc.admin.embeds.presets.categories.delete.useMutation();
  const setCategoryMutation =
    trpc.admin.embeds.presets.setCategory.useMutation();

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
    async (opts?: { linkToPreset?: boolean }) => {
      if (!channelId) {
        toast.error("Please select a target channel");
        return;
      }
      if (!hasContent) {
        toast.error(
          kind === "components"
            ? "Add at least one component"
            : "Message must have content, a title, a description, or at least one field",
        );
        return;
      }

      if (kind === "embed") {
        const incomplete = getIncompleteFieldIndexes(data.fields);
        if (incomplete.length > 0) {
          toast.error(incompleteFieldsMessage(incomplete));
          return;
        }
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
        return;
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
        if (activePreset && shouldLink) linksQuery.refetch();
        toast.success(
          `${kind === "components" ? "Message" : "Embed"} sent${result.messageId ? ` (${result.messageId})` : ""}`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send");
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
      linksQuery,
      toast,
    ],
  );

  const handleSave = useCallback(
    async (opts?: {
      name?: string;
      categoryId?: number | null;
    }): Promise<boolean> => {
      if (kind === "embed") {
        const incomplete = getIncompleteFieldIndexes(data.fields);
        if (incomplete.length > 0) {
          toast.error(incompleteFieldsMessage(incomplete));
          return false;
        }
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
          utils.admin.embeds.presets.list.invalidate();
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
          utils.admin.embeds.presets.list.invalidate();
          utils.admin.embeds.presets.categories.list.invalidate();
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
      currentPayload,
      serializedData,
      activePreset,
      presetName,
      selectedCategoryId,
      updatePreset,
      createPreset,
      utils,
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

  const handleNewEmbed = useCallback(() => {
    setData({ ...DEFAULT_EMBED });
    setComponents([]);
    setActivePreset(null);
    setPresetName("");
    setChannelId("");
    setSelectedCategoryId(null);
    setLastSavedSnapshot("");
    clearDraft();
  }, []);

  const handleUpdateAll = useCallback(async () => {
    if (!activePreset) return;

    if (kind === "embed") {
      const incomplete = getIncompleteFieldIndexes(data.fields);
      if (incomplete.length > 0) {
        toast.error(incompleteFieldsMessage(incomplete));
        return;
      }
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update all",
      );
    }
  }, [
    activePreset,
    kind,
    data,
    currentPayload,
    serializedData,
    bot,
    updateAllMutation,
    toast,
  ]);

  const handleUpdateLink = useCallback(
    async (linkId: number) => {
      if (kind === "embed") {
        const incomplete = getIncompleteFieldIndexes(data.fields);
        if (incomplete.length > 0) {
          toast.error(incompleteFieldsMessage(incomplete));
          return;
        }
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
    [kind, data, currentPayload, bot, updateLinkMutation, toast],
  );

  const handleUnlink = useCallback(
    async (linkId: number) => {
      try {
        await unlinkMutation.mutateAsync({ id: linkId });
        linksQuery.refetch();
        toast.success("Message unlinked");
      } catch {
        toast.error("Failed to unlink message");
      }
    },
    [unlinkMutation, linksQuery, toast],
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
      const existing = await utils.admin.embeds.presets.list.fetch({
        search: baseName,
        limit: 50,
      });
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
        await createPreset.mutateAsync({
          name: copyName,
          categoryId: preset.categoryId ?? null,
          ...payload,
        });
        utils.admin.embeds.presets.list.invalidate();
        utils.admin.embeds.presets.categories.list.invalidate();
        toast.success(`Duplicated as "${copyName}"`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to duplicate preset",
        );
      }
    },
    [createPreset, utils, toast],
  );

  const handleDeletePreset = useCallback(
    async (id: number, name: string) => {
      try {
        await deletePresetMutation.mutateAsync({ id });
        toast.success(`Preset "${name}" deleted`);
        if (activePreset?.id === id) {
          handleNewEmbed();
        }
        utils.admin.embeds.presets.list.invalidate();
        utils.admin.embeds.presets.categories.list.invalidate();
      } catch {
        toast.error("Failed to delete preset");
      }
    },
    [deletePresetMutation, activePreset, handleNewEmbed, utils, toast],
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      try {
        const created = await createCategoryMutation.mutateAsync({ name });
        utils.admin.embeds.presets.categories.list.invalidate();
        toast.success(`Category "${name}" created`);
        return created;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create category",
        );
        return null;
      }
    },
    [createCategoryMutation, utils, toast],
  );

  const handleUpdateCategory = useCallback(
    async (id: number, updates: { name?: string; sortOrder?: number }) => {
      try {
        await updateCategoryMutation.mutateAsync({ id, ...updates });
        utils.admin.embeds.presets.categories.list.invalidate();
        toast.success("Category updated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update category",
        );
      }
    },
    [updateCategoryMutation, utils, toast],
  );

  const handleDeleteCategory = useCallback(
    async (id: number, name: string) => {
      try {
        await deleteCategoryMutation.mutateAsync({ id });
        utils.admin.embeds.presets.categories.list.invalidate();
        utils.admin.embeds.presets.list.invalidate();
        if (activePreset?.categoryId === id) {
          setActivePreset({ ...activePreset, categoryId: null });
          setSelectedCategoryId(null);
        }
        toast.success(`Category "${name}" deleted`);
      } catch {
        toast.error("Failed to delete category");
      }
    },
    [deleteCategoryMutation, activePreset, utils, toast],
  );

  const handleSetPresetCategory = useCallback(
    async (presetId: number, categoryId: number | null) => {
      try {
        await setCategoryMutation.mutateAsync({ presetId, categoryId });
        utils.admin.embeds.presets.list.invalidate();
        utils.admin.embeds.presets.categories.list.invalidate();
        if (activePreset?.id === presetId) {
          setActivePreset({ ...activePreset, categoryId });
          setSelectedCategoryId(categoryId);
        }
        toast.success("Preset moved");
      } catch {
        toast.error("Failed to move preset");
      }
    },
    [setCategoryMutation, activePreset, utils, toast],
  );

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
    handleUpdateAll,
    handleUpdateLink,
    handleUnlink,
    handleDeletePreset,
    handleDuplicatePreset,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleSetPresetCategory,

    // Mutation state
    updateAllPending: updateAllMutation.isPending,
    updateLinkPending: updateLinkMutation.isPending,
  };
}

export type UseEmbedBuilder = ReturnType<typeof useEmbedBuilder>;
