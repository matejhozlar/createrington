import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { plural } from "@/lib/format";
import type {
  ComponentNode,
  EmbedBot,
  EmbedData,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";
import {
  builderReducer,
  INITIAL_STATE,
  payloadOf,
} from "@/features/admin/tools/embed-builder/builder-state";
import {
  clearDraft,
  hasPendingAssistantInsert,
  loadDraft,
  saveDraft,
} from "@/features/admin/tools/embed-builder/draft";
import {
  parsePayload,
  payloadHasContent,
  snapshotOf,
} from "@/features/admin/tools/embed-builder/payload";
import type { PresetRow } from "@/features/admin/tools/embed-builder/preset-row";
import { findPayloadIssue } from "@/features/admin/tools/embed-builder/validation";
import { usePresetActions } from "./use-preset-actions";

function invalidatePresetLists() {
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.list.pathFilter(),
  );
  void queryClient.invalidateQueries(
    trpc.admin.embeds.presets.categories.list.pathFilter(),
  );
}

export function useEmbedBuilder() {
  const toast = useToastActions();
  const [restoredDraft] = useState(loadDraft);
  const [state, dispatch] = useReducer(
    builderReducer,
    restoredDraft ?? INITIAL_STATE,
  );
  const { kind, embed, components, activePreset, presetName, channelId, bot } =
    state;

  const payload = useMemo(
    () => payloadOf({ kind, embed, components }),
    [kind, embed, components],
  );
  const snapshot = useMemo(() => snapshotOf(payload), [payload]);
  const isContentDirty = !!activePreset && snapshot !== state.savedSnapshot;
  const trimmedName = presetName.trim();
  const isNameDirty =
    !!activePreset && !!trimmedName && trimmedName !== activePreset.name;
  const isDirty = isContentDirty || isNameDirty;
  const hasContent = payloadHasContent(payload);

  const draftToastedRef = useRef(false);
  useEffect(() => {
    if (!restoredDraft || draftToastedRef.current) return;
    draftToastedRef.current = true;
    if (!hasPendingAssistantInsert()) {
      toast.info("Draft restored from your last session");
    }
  }, [restoredDraft, toast]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (hasContent || activePreset) saveDraft(state);
      else clearDraft();
    }, 500);
    return () => window.clearTimeout(id);
  }, [state, hasContent, activePreset]);

  const sendMutation = useMutation(
    trpc.admin.embeds.send.mutationOptions(
      useMutationToast({
        success: (result, variables) =>
          `${variables.kind === "components" ? "Message" : "Embed"} sent${result.messageId ? ` (${result.messageId})` : ""}`,
      }),
    ),
  );
  const createMutation = useMutation(
    trpc.admin.embeds.presets.create.mutationOptions(
      useMutationToast({
        success: (created) => `Preset "${created.name}" created`,
        onSuccess: invalidatePresetLists,
      }),
    ),
  );
  const updateMutation = useMutation(
    trpc.admin.embeds.presets.update.mutationOptions(
      useMutationToast({
        success: (_, variables) => {
          const name = variables.name ?? activePreset?.name;
          return name ? `Preset "${name}" updated` : "Preset updated";
        },
        onSuccess: () =>
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.list.pathFilter(),
          ),
      }),
    ),
  );
  const updateAllMutation = useMutation(
    trpc.admin.embeds.presets.links.updateAll.mutationOptions(
      useMutationToast({
        onSuccess: (result) => {
          if (result.failed > 0) {
            toast.warning(
              `Updated ${result.updated}, failed ${result.failed}`,
              "Partial update",
            );
          } else {
            toast.success(
              `Updated ${result.updated} linked ${plural(result.updated, "message")}`,
            );
          }
        },
      }),
    ),
  );

  const isPending =
    sendMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending;

  const hasActionButtons =
    payload.kind === "embed" && payload.embed.actionButtons.length > 0;

  const validateOrToast = (): boolean => {
    const issue = findPayloadIssue(payload);
    if (issue) toast.error(issue);
    return !issue;
  };

  const validateForPublishOrToast = (): boolean => {
    if (!validateOrToast()) return false;
    if (hasActionButtons && isContentDirty) {
      toast.error(
        "Save the preset first: action buttons run what the saved preset holds.",
      );
      return false;
    }
    return true;
  };

  const handleSend = async (linkToPreset = true): Promise<boolean> => {
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
    if (hasActionButtons && !activePreset) {
      toast.error(
        "Save as a preset first: action buttons need a preset to function.",
      );
      return false;
    }
    if (!validateForPublishOrToast()) return false;

    const presetId =
      hasActionButtons || linkToPreset ? activePreset?.id : undefined;
    try {
      await sendMutation.mutateAsync({ channelId, presetId, bot, ...payload });
    } catch {
      return false;
    }
    if (presetId !== undefined) {
      void queryClient.invalidateQueries(
        trpc.admin.embeds.presets.links.list.pathFilter(),
      );
    }
    return true;
  };

  const handleSave = async (opts?: {
    name?: string;
    categoryId?: number | null;
  }): Promise<boolean> => {
    if (!validateOrToast()) return false;

    if (activePreset) {
      const name = isNameDirty ? trimmedName : undefined;
      try {
        await updateMutation.mutateAsync({
          id: activePreset.id,
          name,
          payload,
        });
      } catch {
        return false;
      }
      dispatch({
        type: "saved",
        snapshot,
        preset: name ? { ...activePreset, name } : undefined,
      });
      return true;
    }

    const name = (opts?.name ?? presetName).trim();
    if (!name) {
      toast.error("Enter a preset name to save");
      return false;
    }
    let created;
    try {
      created = await createMutation.mutateAsync({
        name,
        categoryId:
          opts?.categoryId !== undefined
            ? opts.categoryId
            : state.selectedCategoryId,
        ...payload,
      });
    } catch {
      return false;
    }
    dispatch({
      type: "saved",
      snapshot,
      preset: {
        id: created.id,
        name: created.name,
        categoryId: created.categoryId,
      },
    });
    return true;
  };

  const handleUpdateAll = async (): Promise<boolean> => {
    if (!activePreset || !validateOrToast()) return false;
    try {
      await updateAllMutation.mutateAsync({
        presetId: activePreset.id,
        bot,
        ...payload,
      });
    } catch {
      return false;
    }
    dispatch({ type: "saved", snapshot });
    return true;
  };

  const loadPreset = (row: PresetRow) => {
    const loaded = parsePayload(row.kind, row.data);
    if (!loaded) {
      toast.error(`"${row.name}" holds a message the builder cannot read`);
      return;
    }
    dispatch({
      type: "load",
      payload: loaded,
      snapshot: snapshotOf(loaded),
      preset: { id: row.id, name: row.name, categoryId: row.categoryId },
    });
    toast.success(`Loaded "${row.name}"`);
  };

  const importPayload = useCallback(
    (next: MessagePayload) => dispatch({ type: "import", payload: next }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const presetActions = usePresetActions({
    activePreset,
    onActivePresetMoved: (categoryId) =>
      dispatch({ type: "movePreset", categoryId }),
    onActivePresetDeleted: reset,
  });

  return {
    state,
    payload,
    isDirty,
    hasContent,
    hasActionButtons,
    isPending,

    setKind: (next: PresetKind) => dispatch({ type: "setKind", kind: next }),
    setEmbed: (update: EmbedData | ((prev: EmbedData) => EmbedData)) =>
      dispatch({ type: "setEmbed", update }),
    setComponents: (
      update: ComponentNode[] | ((prev: ComponentNode[]) => ComponentNode[]),
    ) => dispatch({ type: "setComponents", update }),
    setPresetName: (name: string) => dispatch({ type: "setPresetName", name }),
    setChannelId: (next: string) =>
      dispatch({ type: "setChannel", channelId: next }),
    setBot: (next: EmbedBot) => dispatch({ type: "setBot", bot: next }),

    validateOrToast,
    validateForPublishOrToast,
    handleSend,
    handleSave,
    handleUpdateAll,
    updateAllPending: updateAllMutation.isPending,
    loadPreset,
    importPayload,
    reset,
    presetActions,
  };
}

export type UseEmbedBuilder = ReturnType<typeof useEmbedBuilder>;
