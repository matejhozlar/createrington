import { z } from "zod";
import {
  PENDING_EMBED_KEY,
  PENDING_COMPONENTS_KEY,
} from "@/features/admin-chat/actions";
import {
  embedBotSchema,
  presetKindSchema,
} from "@createrington/shared/api/embed";
import { localStore, sessionStore } from "@/lib/storage";
import type { BuilderState } from "./builder-state";
import { parseComponents, parseEmbed } from "./payload";

const DRAFT_KEY = "embed-builder-draft";

const storedDraftSchema = z.object({
  kind: presetKindSchema.catch("embed"),
  data: z.record(z.string(), z.unknown()),
  components: z.unknown(),
  presetName: z.string().catch(""),
  bot: embedBotSchema.catch("main"),
  channelId: z.string().catch(""),
  activePreset: z
    .object({
      id: z.number(),
      name: z.string(),
      categoryId: z.number().nullable(),
    })
    .nullable()
    .catch(null),
  selectedCategoryId: z.number().nullable().catch(null),
  savedSnapshot: z.string().catch(""),
});

export function loadDraft(): BuilderState | null {
  const stored = storedDraftSchema.safeParse(localStore.getJson(DRAFT_KEY));
  if (!stored.success) return null;
  const { data, components, ...rest } = stored.data;
  return {
    ...rest,
    embed: parseEmbed(data),
    components: parseComponents(components) ?? [],
  };
}

export function saveDraft({ embed, ...rest }: BuilderState): void {
  localStore.setJson(DRAFT_KEY, { ...rest, data: embed });
}

export function clearDraft(): void {
  localStore.remove(DRAFT_KEY);
}

export function hasPendingAssistantInsert(): boolean {
  return (
    sessionStore.get(PENDING_EMBED_KEY) !== null ||
    sessionStore.get(PENDING_COMPONENTS_KEY) !== null
  );
}
