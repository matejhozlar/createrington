import { describe, expect, it } from "vitest";
import {
  coerceAction,
  parseActionsFromMessage,
} from "@/features/admin-chat/actions";

describe("coerceAction", () => {
  it("nests a flattened embed under embed without touching the input", () => {
    const raw = {
      type: "insert_embed",
      title: "Restart",
      color: 0xff0000,
      label: "Restart notice",
    };
    const snapshot = structuredClone(raw);

    expect(coerceAction(raw)).toEqual({
      type: "insert_embed",
      embed: { title: "Restart", color: 0xff0000 },
      label: "Restart notice",
    });
    expect(raw).toEqual(snapshot);
  });

  it("returns the same result when called twice on the same payload", () => {
    const raw = { type: "insert_embed", description: "Hello" };

    expect(coerceAction(raw)).toEqual(coerceAction(raw));
  });

  it("keeps an embed that is already nested", () => {
    expect(
      coerceAction({ type: "insert_embed", embed: { title: "Nested" } }),
    ).toEqual({ type: "insert_embed", embed: { title: "Nested" } });
  });

  it("rejects payloads that are missing their required field", () => {
    expect(coerceAction({ type: "insert_embed" })).toBeNull();
    expect(coerceAction({ type: "highlight", selector: "" })).toBeNull();
    expect(coerceAction({ type: "navigate", path: "admin" })).toBeNull();
    expect(
      coerceAction({ type: "insert_components", components: [] }),
    ).toBeNull();
    expect(coerceAction({ type: "unknown" })).toBeNull();
    expect(coerceAction(null)).toBeNull();
  });

  it("keeps a new plan with its title, category and body", () => {
    expect(
      coerceAction({
        type: "plan_create",
        title: "Rework the economy",
        body: "## Why\nMoney has no use.",
        category: "modpack",
        subcategoryId: 4,
        label: "Economy plan",
      }),
    ).toEqual({
      type: "plan_create",
      title: "Rework the economy",
      body: "## Why\nMoney has no use.",
      category: "modpack",
      subcategoryId: 4,
      label: "Economy plan",
    });
  });

  it("rejects a new plan without a title or with an unknown category", () => {
    expect(
      coerceAction({ type: "plan_create", category: "modpack" }),
    ).toBeNull();
    expect(
      coerceAction({ type: "plan_create", title: "  ", category: "modpack" }),
    ).toBeNull();
    expect(
      coerceAction({ type: "plan_create", title: "Plan", category: "lore" }),
    ).toBeNull();
    expect(coerceAction({ type: "plan_create", title: "Plan" })).toBeNull();
  });

  it("keeps only the fields a plan edit names", () => {
    expect(
      coerceAction({ type: "plan_update", id: 12, status: "approved" }),
    ).toEqual({ type: "plan_update", id: 12, status: "approved" });
    expect(
      coerceAction({ type: "plan_update", id: 12, subcategoryId: null }),
    ).toEqual({ type: "plan_update", id: 12, subcategoryId: null });
  });

  it("rejects a plan edit that changes nothing or is malformed", () => {
    expect(coerceAction({ type: "plan_update", id: 12 })).toBeNull();
    expect(
      coerceAction({ type: "plan_update", id: 12, label: "Nothing" }),
    ).toBeNull();
    expect(coerceAction({ type: "plan_update", body: "No id" })).toBeNull();
    expect(
      coerceAction({ type: "plan_update", id: "12", body: "Text" }),
    ).toBeNull();
    expect(
      coerceAction({ type: "plan_update", id: 12, status: "done" }),
    ).toBeNull();
    expect(
      coerceAction({ type: "plan_update", id: 12, subcategoryId: 1.5 }),
    ).toBeNull();
  });
});

describe("parseActionsFromMessage", () => {
  it("lifts a valid action fence out of the message", () => {
    const raw =
      'Here you go\n```action\n{"type":"navigate","path":"/admin"}\n```';

    expect(parseActionsFromMessage(raw)).toEqual({
      content: "Here you go",
      actions: [{ type: "navigate", path: "/admin" }],
    });
  });
});
