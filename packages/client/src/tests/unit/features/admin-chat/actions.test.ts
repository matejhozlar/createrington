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
