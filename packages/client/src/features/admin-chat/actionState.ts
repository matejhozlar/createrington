import { localStore, sessionStore, type SafeStorage } from "@/lib/storage";
import { isPlanAction, type AdminChatAction } from "./actions";

export type ActionState = "pending" | "applied" | "dismissed";

function storageFor(action: AdminChatAction): SafeStorage {
  return isPlanAction(action) ? localStore : sessionStore;
}

function keyFor(storageKey: string): string {
  return `admin-chat-action:${storageKey}`;
}

export function readActionState(
  action: AdminChatAction,
  storageKey: string,
): ActionState {
  const value = storageFor(action).get(keyFor(storageKey));
  return value === "applied" || value === "dismissed" ? value : "pending";
}

export function saveActionState(
  action: AdminChatAction,
  storageKey: string,
  state: Exclude<ActionState, "pending">,
): void {
  storageFor(action).set(keyFor(storageKey), state);
}
