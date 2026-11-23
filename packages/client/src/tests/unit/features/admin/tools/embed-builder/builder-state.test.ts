import { describe, expect, it } from "vitest";
import {
  builderReducer,
  INITIAL_STATE,
  payloadOf,
  type BuilderState,
} from "@/features/admin/tools/embed-builder/builder-state";
import {
  DEFAULT_EMBED,
  snapshotOf,
} from "@/features/admin/tools/embed-builder/payload";

const preset = { id: 4, name: "Rules", categoryId: 2 };

const loaded: BuilderState = builderReducer(INITIAL_STATE, {
  type: "load",
  preset,
  payload: { kind: "embed", embed: { ...DEFAULT_EMBED, title: "Rules" } },
  snapshot: "saved",
});

describe("builderReducer", () => {
  it("loads a preset with its name, category and saved snapshot", () => {
    expect(loaded).toMatchObject({
      kind: "embed",
      embed: { title: "Rules" },
      activePreset: preset,
      presetName: "Rules",
      selectedCategoryId: 2,
      savedSnapshot: "saved",
    });
  });

  it("keeps the other mode's document when switching mode", () => {
    const withTree = builderReducer(loaded, {
      type: "setComponents",
      update: [{ type: "text", content: "Hi" }],
    });
    const switched = builderReducer(
      builderReducer(withTree, { type: "setKind", kind: "components" }),
      { type: "setKind", kind: "embed" },
    );

    expect(switched.embed.title).toBe("Rules");
    expect(switched.components).toEqual([{ type: "text", content: "Hi" }]);
  });

  it("applies an updater to the embed", () => {
    const next = builderReducer(loaded, {
      type: "setEmbed",
      update: (prev) => ({ ...prev, description: "Be kind" }),
    });

    expect(next.embed).toMatchObject({
      title: "Rules",
      description: "Be kind",
    });
  });

  it("detaches the preset when a message is imported", () => {
    const next = builderReducer(loaded, {
      type: "import",
      payload: {
        kind: "components",
        components: { components: [{ type: "text", content: "Hi" }] },
      },
    });

    expect(next).toMatchObject({
      kind: "components",
      embed: DEFAULT_EMBED,
      activePreset: null,
      presetName: "",
      selectedCategoryId: null,
      savedSnapshot: "",
    });
  });

  it("records the saved snapshot and keeps a typed rename otherwise", () => {
    const renamed = builderReducer(loaded, {
      type: "setPresetName",
      name: "Rules v2",
    });
    const next = builderReducer(renamed, { type: "saved", snapshot: "new" });

    expect(next.savedSnapshot).toBe("new");
    expect(next.presetName).toBe("Rules v2");
  });

  it("adopts a newly created preset on save", () => {
    const next = builderReducer(INITIAL_STATE, {
      type: "saved",
      snapshot: "new",
      preset: { id: 9, name: "Welcome", categoryId: null },
    });

    expect(next).toMatchObject({
      activePreset: { id: 9, name: "Welcome", categoryId: null },
      presetName: "Welcome",
      savedSnapshot: "new",
    });
  });

  it("moves the active preset to another category", () => {
    const next = builderReducer(loaded, {
      type: "movePreset",
      categoryId: null,
    });

    expect(next.activePreset?.categoryId).toBeNull();
    expect(next.selectedCategoryId).toBeNull();
  });

  it("starts over on reset but keeps the chosen bot", () => {
    const withChannel = builderReducer(loaded, {
      type: "setChannel",
      channelId: "123",
    });

    expect(builderReducer(withChannel, { type: "reset" })).toEqual(
      INITIAL_STATE,
    );
  });
});

describe("payloadOf", () => {
  it("sends only the document of the current mode", () => {
    const payload = payloadOf({ ...loaded, kind: "embed" });

    expect(payload).toEqual({ kind: "embed", embed: loaded.embed });
    expect(snapshotOf(payload)).toBe(JSON.stringify(loaded.embed));
  });
});
