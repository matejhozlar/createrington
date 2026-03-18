import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { EmbedData, EmbedBot, EmbedField } from "@createrington/shared/api/embed";

export interface EmbedFieldInternal extends EmbedField {
  _id: string;
}

export interface EmbedDataInternal extends Omit<EmbedData, "fields"> {
  fields: EmbedFieldInternal[];
}

export interface ActivePreset {
  id: number;
  name: string;
}

const DEFAULT_EMBED: EmbedDataInternal = {
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
};

function assignFieldIds(fields: EmbedField[]): EmbedFieldInternal[] {
  return fields.map((f) => ({ ...f, _id: crypto.randomUUID() }));
}

function stripFieldIds(fields: EmbedFieldInternal[]): EmbedField[] {
  return fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline }));
}

function toExternalData(data: EmbedDataInternal): EmbedData {
  return { ...data, fields: stripFieldIds(data.fields) };
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

  // --- State ---
  const [data, setData] = useState<EmbedDataInternal>({ ...DEFAULT_EMBED });
  const [bot, setBot] = useState<EmbedBot>("main");
  const [channelId, setChannelId] = useState("");
  const [activePreset, setActivePreset] = useState<ActivePreset | null>(null);
  const [presetName, setPresetName] = useState("");
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 300);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");

  const isDirty = useMemo(() => {
    if (!activePreset) return false;
    return JSON.stringify(toExternalData(data)) !== lastSavedSnapshot;
  }, [data, activePreset, lastSavedSnapshot]);

  const hasContent = !!(data.title || data.description || data.fields.length > 0);

  // --- Queries ---
  const utils = trpc.useUtils();

  const presetsQuery = trpc.admin.embeds.presets.list.useQuery({
    search: debouncedSearch || undefined,
    limit: 50,
  });

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

  // --- Mutations ---
  const sendEmbed = trpc.admin.embeds.send.useMutation();
  const createPreset = trpc.admin.embeds.presets.create.useMutation();
  const updatePreset = trpc.admin.embeds.presets.update.useMutation();
  const deletePresetMutation = trpc.admin.embeds.presets.delete.useMutation();
  const unlinkMutation = trpc.admin.embeds.presets.links.delete.useMutation();
  const updateAllMutation = trpc.admin.embeds.updateAll.useMutation();
  const updateLinkMutation = trpc.admin.embeds.updateLink.useMutation();

  const isPending =
    sendEmbed.isPending ||
    createPreset.isPending ||
    updatePreset.isPending;

  // --- Data setter that works with internal type ---
  const setEmbedData = useCallback(
    (updater: EmbedData | ((prev: EmbedData) => EmbedData)) => {
      setData((prev) => {
        const prevExternal = toExternalData(prev);
        const next = typeof updater === "function" ? updater(prevExternal) : updater;
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
          return { ...f, _id: (f as EmbedFieldInternal)._id ?? existing?._id ?? crypto.randomUUID() };
        });
        return { ...next, fields };
      });
    },
    [],
  );

  // --- Handlers ---
  const handleSend = useCallback(async () => {
    if (!channelId) {
      toast.error("Please select a target channel");
      return;
    }
    if (!hasContent) {
      toast.error("Embed must have a title, description, or at least one field");
      return;
    }

    try {
      const result = await sendEmbed.mutateAsync({
        channelId,
        embed: toExternalData(data),
        presetId: activePreset?.id,
        bot,
      });
      if (activePreset) linksQuery.refetch();
      toast.success(`Embed sent${result.messageId ? ` (${result.messageId})` : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send embed");
    }
  }, [channelId, hasContent, data, activePreset, bot, sendEmbed, linksQuery, toast]);

  const handleSave = useCallback(async () => {
    const embedData = toExternalData(data);

    if (activePreset) {
      try {
        const updates: { id: number; name?: string; data?: EmbedData } = {
          id: activePreset.id,
          data: embedData,
        };
        if (presetName.trim() && presetName.trim() !== activePreset.name) {
          updates.name = presetName.trim();
        }
        await updatePreset.mutateAsync(updates);
        setLastSavedSnapshot(JSON.stringify(embedData));
        if (updates.name) {
          setActivePreset({ ...activePreset, name: updates.name });
        }
        utils.admin.embeds.presets.list.invalidate();
        toast.success(`Preset "${updates.name ?? activePreset.name}" updated`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update preset");
      }
    } else {
      if (!presetName.trim()) {
        toast.error("Enter a preset name to save");
        return;
      }
      try {
        await createPreset.mutateAsync({
          name: presetName.trim(),
          data: embedData,
        });
        setLastSavedSnapshot(JSON.stringify(embedData));
        utils.admin.embeds.presets.list.invalidate();
        // Reload the preset list and find the newly created preset to set it as active
        const refreshed = await utils.admin.embeds.presets.list.fetch({
          search: undefined,
          limit: 50,
        });
        const created = refreshed.presets.find(
          (p) => p.name === presetName.trim(),
        );
        if (created) {
          setActivePreset({ id: created.id, name: created.name });
        }
        toast.success(`Preset "${presetName.trim()}" created`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save preset");
      }
    }
  }, [data, activePreset, presetName, updatePreset, createPreset, utils, toast]);

  const handleLoadPreset = useCallback(
    (preset: { id: number; name: string; data: unknown }) => {
      const normalized = normalizeLoadedEmbed(preset.data as EmbedData);
      setData(normalized);
      setActivePreset({ id: preset.id, name: preset.name });
      setPresetName(preset.name);
      setLastSavedSnapshot(JSON.stringify(toExternalData(normalized)));
      toast.success(`Loaded "${preset.name}"`);
    },
    [toast],
  );

  const handleNewEmbed = useCallback(() => {
    setData({ ...DEFAULT_EMBED });
    setActivePreset(null);
    setPresetName("");
    setChannelId("");
    setLastSavedSnapshot("");
  }, []);

  const handleUpdateAll = useCallback(async () => {
    if (!activePreset) return;

    try {
      const result = await updateAllMutation.mutateAsync({
        presetId: activePreset.id,
        embed: toExternalData(data),
        bot,
      });
      setLastSavedSnapshot(JSON.stringify(toExternalData(data)));
      if (result.failed > 0) {
        toast.warning(
          `Updated ${result.updated}, failed ${result.failed}`,
          "Partial update",
        );
      } else {
        toast.success(`Updated ${result.updated} linked message${result.updated === 1 ? "" : "s"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update all");
    }
  }, [activePreset, data, bot, updateAllMutation, toast]);

  const handleUpdateLink = useCallback(
    async (linkId: number) => {
      try {
        await updateLinkMutation.mutateAsync({
          linkId,
          embed: toExternalData(data),
          bot,
        });
        toast.success("Linked message updated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update message",
        );
      }
    },
    [data, bot, updateLinkMutation, toast],
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

  const handleDeletePreset = useCallback(
    async (id: number, name: string) => {
      try {
        await deletePresetMutation.mutateAsync({ id });
        toast.success(`Preset "${name}" deleted`);
        if (activePreset?.id === id) {
          handleNewEmbed();
        }
        utils.admin.embeds.presets.list.invalidate();
      } catch {
        toast.error("Failed to delete preset");
      }
    },
    [deletePresetMutation, activePreset, handleNewEmbed, utils, toast],
  );

  return {
    // State
    data,
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
    isDirty,
    hasContent,
    isPending,

    // Queries
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

    // Mutation state
    updateAllPending: updateAllMutation.isPending,
    updateLinkPending: updateLinkMutation.isPending,
  };
}

export type UseEmbedBuilder = ReturnType<typeof useEmbedBuilder>;
