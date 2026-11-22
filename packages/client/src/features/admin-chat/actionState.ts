import { isPlanAction, type AdminChatAction } from "./actions";

export type ActionState = "pending" | "applied" | "dismissed";

function storageFor(action: AdminChatAction): Storage {
  return isPlanAction(action) ? localStorage : sessionStorage;
}

function keyFor(storageKey: string): string {
  return `admin-chat-action:${storageKey}`;
}

export function readActionState(
  action: AdminChatAction,
  storageKey: string,
): ActionState {
  try {
    const value = storageFor(action).getItem(keyFor(storageKey));
    if (value === "applied" || value === "dismissed") return value;
  } catch {}
  return "pending";
}

export function saveActionState(
  action: AdminChatAction,
  storageKey: string,
  state: Exclude<ActionState, "pending">,
): void {
  try {
    storageFor(action).setItem(keyFor(storageKey), state);
  } catch {}
}
