import type {
  ComponentNode,
  EmbedBot,
  EmbedData,
  MessagePayload,
  PresetKind,
} from "@createrington/shared/api/embed";
import { DEFAULT_EMBED, snapshotOf } from "./payload";

export interface ActivePreset {
  id: number;
  name: string;
  categoryId: number | null;
}

export interface BuilderState {
  kind: PresetKind;
  embed: EmbedData;
  components: ComponentNode[];
  activePreset: ActivePreset | null;
  presetName: string;
  selectedCategoryId: number | null;
  channelId: string;
  bot: EmbedBot;
  savedSnapshot: string;
}

type Update<T> = T | ((prev: T) => T);

export type BuilderAction =
  | { type: "setKind"; kind: PresetKind }
  | { type: "setEmbed"; update: Update<EmbedData> }
  | { type: "setComponents"; update: Update<ComponentNode[]> }
  | { type: "setPresetName"; name: string }
  | { type: "setChannel"; channelId: string }
  | { type: "setBot"; bot: EmbedBot }
  | {
      type: "load";
      preset: ActivePreset;
      payload: MessagePayload;
      snapshot: string;
    }
  | { type: "import"; payload: MessagePayload }
  | { type: "saved"; snapshot: string; preset?: ActivePreset }
  | { type: "movePreset"; categoryId: number | null }
  | {
      type: "presetChanged";
      presetId: number;
      payload: MessagePayload;
      snapshot: string;
    }
  | { type: "presetDeleted"; presetId: number }
  | { type: "reset" };

export const INITIAL_STATE: BuilderState = {
  kind: "embed",
  embed: DEFAULT_EMBED,
  components: [],
  activePreset: null,
  presetName: "",
  selectedCategoryId: null,
  channelId: "",
  bot: "main",
  savedSnapshot: "",
};

const DETACHED = {
  activePreset: null,
  presetName: "",
  selectedCategoryId: null,
  savedSnapshot: "",
} satisfies Partial<BuilderState>;

function apply<T>(prev: T, update: Update<T>): T {
  return typeof update === "function"
    ? (update as (prev: T) => T)(prev)
    : update;
}

function documentOf(payload: MessagePayload) {
  return payload.kind === "components"
    ? {
        kind: payload.kind,
        embed: DEFAULT_EMBED,
        components: payload.components.components,
      }
    : { kind: payload.kind, embed: payload.embed, components: [] };
}

export function payloadOf(
  state: Pick<BuilderState, "kind" | "embed" | "components">,
): MessagePayload {
  return state.kind === "components"
    ? { kind: "components", components: { components: state.components } }
    : { kind: "embed", embed: state.embed };
}

export function builderReducer(
  state: BuilderState,
  action: BuilderAction,
): BuilderState {
  switch (action.type) {
    case "setKind":
      return { ...state, kind: action.kind };
    case "setEmbed":
      return { ...state, embed: apply(state.embed, action.update) };
    case "setComponents":
      return { ...state, components: apply(state.components, action.update) };
    case "setPresetName":
      return { ...state, presetName: action.name };
    case "setChannel":
      return { ...state, channelId: action.channelId };
    case "setBot":
      return { ...state, bot: action.bot };
    case "load":
      return {
        ...state,
        ...documentOf(action.payload),
        activePreset: action.preset,
        presetName: action.preset.name,
        selectedCategoryId: action.preset.categoryId,
        savedSnapshot: action.snapshot,
      };
    case "import":
      return { ...state, ...documentOf(action.payload), ...DETACHED };
    case "saved":
      return action.preset
        ? {
            ...state,
            savedSnapshot: action.snapshot,
            activePreset: action.preset,
            presetName: action.preset.name,
            selectedCategoryId: action.preset.categoryId,
          }
        : { ...state, savedSnapshot: action.snapshot };
    case "movePreset":
      return state.activePreset
        ? {
            ...state,
            activePreset: {
              ...state.activePreset,
              categoryId: action.categoryId,
            },
            selectedCategoryId: action.categoryId,
          }
        : state;
    case "presetChanged": {
      if (state.activePreset?.id !== action.presetId) return state;
      const unedited = snapshotOf(payloadOf(state)) === state.savedSnapshot;
      return unedited
        ? {
            ...state,
            ...documentOf(action.payload),
            savedSnapshot: action.snapshot,
          }
        : { ...state, savedSnapshot: action.snapshot };
    }
    case "presetDeleted":
      return state.activePreset?.id === action.presetId
        ? { ...state, ...DETACHED }
        : state;
    case "reset":
      return { ...INITIAL_STATE, bot: state.bot };
  }
}
