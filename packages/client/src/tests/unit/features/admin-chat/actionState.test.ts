import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readActionState,
  saveActionState,
} from "@/features/admin-chat/actionState";
import type { AdminChatAction } from "@/features/admin-chat/actions";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

function openNewTab(): void {
  vi.stubGlobal("sessionStorage", memoryStorage());
}

const createPlan: AdminChatAction = {
  type: "plan_create",
  title: "Rework the economy",
  categories: ["modpack"],
};
const editPlan: AdminChatAction = {
  type: "plan_update",
  id: 12,
  status: "open",
};
const goToPlayers: AdminChatAction = {
  type: "navigate",
  path: "/admin/players",
};

describe("chat action state", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts as pending", () => {
    expect(readActionState(createPlan, "db-1")).toBe("pending");
  });

  it("remembers what happened to a card in the same tab", () => {
    saveActionState(goToPlayers, "db-1", "dismissed");

    expect(readActionState(goToPlayers, "db-1")).toBe("dismissed");
    expect(readActionState(goToPlayers, "db-2")).toBe("pending");
  });

  it("keeps an applied plan applied when the chat is opened in a new tab", () => {
    saveActionState(createPlan, "db-1", "applied");
    saveActionState(editPlan, "db-2", "applied");
    openNewTab();

    expect(readActionState(createPlan, "db-1")).toBe("applied");
    expect(readActionState(editPlan, "db-2")).toBe("applied");
  });

  it("lets a repeatable action be applied again in a new tab", () => {
    saveActionState(goToPlayers, "db-3", "applied");
    openNewTab();

    expect(readActionState(goToPlayers, "db-3")).toBe("pending");
  });

  it("falls back to pending when storage is not available", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    saveActionState(createPlan, "db-1", "applied");

    expect(readActionState(createPlan, "db-1")).toBe("pending");
  });
});
