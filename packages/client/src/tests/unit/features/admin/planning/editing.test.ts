import { describe, expect, it } from "vitest";
import {
  afterSave,
  changedFields,
  isNewerThan,
  toEditBase,
} from "@/features/admin/planning/editing";

const item = {
  revision: 4,
  title: "Give money a purpose",
  body: null,
  category: "modpack",
  subcategoryId: 10,
  status: "inbox",
  decision: null,
} as const;

describe("toEditBase", () => {
  it("turns missing text into empty fields at the item's revision", () => {
    const base = toEditBase(item);

    expect(base.revision).toBe(4);
    expect(base.draft).toMatchObject({ body: "", decision: "" });
    expect(changedFields(base.draft, base.draft)).toEqual({});
  });
});

describe("afterSave", () => {
  it("treats only what was sent as saved, so later typing stays unsaved", () => {
    const base = toEditBase(item);
    const sent = {
      status: "decided",
      decision: "Shops sell upgrades",
    } as const;
    const typedWhileSaving = {
      ...base.draft,
      ...sent,
      decision: "Shops sell upgrades and cosmetics",
    };

    const saved = afterSave(base, sent, 5);

    expect(saved.revision).toBe(5);
    expect(saved.draft).toMatchObject(sent);
    expect(changedFields(typedWhileSaving, saved.draft)).toEqual({
      decision: "Shops sell upgrades and cosmetics",
    });
  });
});

describe("isNewerThan", () => {
  it("ignores the cached item until it catches up with a save", () => {
    const saved = afterSave(toEditBase(item), { title: "Renamed" }, 5);

    expect(isNewerThan({ revision: 4 }, saved)).toBe(false);
    expect(isNewerThan({ revision: 5 }, saved)).toBe(false);
  });

  it("flags a revision someone else wrote", () => {
    expect(isNewerThan({ revision: 5 }, toEditBase(item))).toBe(true);
  });
});
