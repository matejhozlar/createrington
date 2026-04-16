import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENT_GROUPS,
  getGroupById,
  getGroupsByCategory,
  validateDefinitions,
} from "@/services/achievement/definitions";
import { AchievementCategory } from "@/services/achievement/types";

describe("ACHIEVEMENT_GROUPS catalog", () => {
  it("is non-empty", () => {
    expect(ACHIEVEMENT_GROUPS.length).toBeGreaterThan(0);
  });

  it("has unique group IDs", () => {
    const ids = ACHIEVEMENT_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every group has at least one tier", () => {
    for (const group of ACHIEVEMENT_GROUPS) {
      expect(group.tiers.length).toBeGreaterThan(0);
    }
  });

  it("every group uses a known category", () => {
    const known = new Set(Object.values(AchievementCategory));
    for (const group of ACHIEVEMENT_GROUPS) {
      expect(known.has(group.category)).toBe(true);
    }
  });
});

describe("getGroupById", () => {
  it("returns the group with the matching id", () => {
    const sample = ACHIEVEMENT_GROUPS[0];
    expect(getGroupById(sample.id)).toBe(sample);
  });

  it("returns undefined for an unknown id", () => {
    expect(getGroupById("definitely-not-a-real-group")).toBeUndefined();
  });
});

describe("getGroupsByCategory", () => {
  it("returns every group within the category, and only those", () => {
    for (const category of Object.values(AchievementCategory)) {
      const groups = getGroupsByCategory(category);
      const expected = ACHIEVEMENT_GROUPS.filter(
        (g) => g.category === category,
      );
      expect(groups).toHaveLength(expected.length);
      for (const g of groups) expect(g.category).toBe(category);
    }
  });

  it("returns an empty array for an unknown category", () => {
    expect(getGroupsByCategory("not-a-category")).toEqual([]);
  });
});

describe("validateDefinitions", () => {
  it("does not throw against the live catalog (regression guard)", () => {
    expect(() => validateDefinitions()).not.toThrow();
  });
});
