import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_COMPONENTS_KEY,
  PENDING_EMBED_KEY,
} from "@/features/admin-chat/actions";
import {
  clearDraft,
  hasPendingAssistantInsert,
  loadDraft,
  saveDraft,
} from "@/features/admin/tools/embed-builder/draft";
import {
  DEFAULT_EMBED,
  toExternalData,
} from "@/features/admin/tools/embed-builder/embed-data";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const draft: Parameters<typeof saveDraft>[0] = {
  kind: "embed",
  data: toExternalData({ ...DEFAULT_EMBED, title: "Rules" }),
  components: [],
  presetName: "Rules",
  bot: "main",
  channelId: "123",
  activePreset: { id: 4, name: "Rules", categoryId: null },
  selectedCategoryId: null,
};

describe("embed builder draft", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no draft before anything was saved", () => {
    expect(loadDraft()).toBeNull();
  });

  it("returns what was saved", () => {
    saveDraft(draft);

    expect(loadDraft()).toEqual(draft);
  });

  it("forgets the draft once it is cleared", () => {
    saveDraft(draft);
    clearDraft();

    expect(loadDraft()).toBeNull();
  });

  it("ignores a stored value that is not valid JSON", () => {
    localStorage.setItem("embed-builder-draft", "{not json");

    expect(loadDraft()).toBeNull();
  });

  it("ignores a stored value without embed data", () => {
    localStorage.setItem(
      "embed-builder-draft",
      JSON.stringify({ kind: "embed" }),
    );

    expect(loadDraft()).toBeNull();
  });

  it("survives storage that throws", () => {
    const broken = () => {
      throw new Error("storage disabled");
    };
    vi.stubGlobal("localStorage", {
      getItem: broken,
      setItem: broken,
      removeItem: broken,
    });

    expect(loadDraft()).toBeNull();
    expect(() => saveDraft(draft)).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
  });

  it("sees an embed or a component tree the assistant left to insert", () => {
    expect(hasPendingAssistantInsert()).toBe(false);

    sessionStorage.setItem(PENDING_EMBED_KEY, "{}");
    expect(hasPendingAssistantInsert()).toBe(true);

    sessionStorage.removeItem(PENDING_EMBED_KEY);
    sessionStorage.setItem(PENDING_COMPONENTS_KEY, "[]");
    expect(hasPendingAssistantInsert()).toBe(true);
  });
});
