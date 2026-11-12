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

export function saveDraft(state: DraftState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

export function hasPendingAssistantInsert(): boolean {
  try {
    return (
      sessionStorage.getItem(PENDING_EMBED_KEY) !== null ||
      sessionStorage.getItem(PENDING_COMPONENTS_KEY) !== null
    );
  } catch {
    return false;
  }
}
