import {
  PENDING_EMBED_KEY,
  PENDING_COMPONENTS_KEY,
} from "@/features/admin-chat/actions";
import type {
  ComponentNode,
  EmbedBot,
  EmbedData,
  PresetKind,
} from "@createrington/shared/api/embed";
import { localStore, sessionStore } from "@/lib/storage";
import type { ActivePreset } from "./embed-data";

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
  savedSnapshot?: string;
}

export function loadDraft(): DraftState | null {
  const parsed = localStore.getJson(DRAFT_KEY) as DraftState | null;
  if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
  return parsed;
}

export function saveDraft(state: DraftState): void {
  localStore.setJson(DRAFT_KEY, state);
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
