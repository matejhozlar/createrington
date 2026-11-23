import { localStore } from "@/lib/storage";

export type PlayerHint = {
  uuid: string;
  username: string;
};

export const PLAYER_HINT_KEY = "skin-runner:player";

export const DEFAULT_PLAYER: PlayerHint = {
  uuid: "091b900c-4174-478c-900c-a0fe5a31a329",
  username: "saunhardy",
};

function isPlayerHint(value: unknown): value is PlayerHint {
  if (typeof value !== "object" || value === null) return false;
  const { uuid, username } = value as Record<string, unknown>;
  return (
    typeof uuid === "string" &&
    uuid.length > 0 &&
    typeof username === "string" &&
    username.length > 0
  );
}

export function readPlayerHint(): PlayerHint {
  const stored = localStore.getJson(PLAYER_HINT_KEY);
  return isPlayerHint(stored) ? stored : DEFAULT_PLAYER;
}

export function writePlayerHint(hint: PlayerHint | null): void {
  if (hint) localStore.setJson(PLAYER_HINT_KEY, hint);
  else localStore.remove(PLAYER_HINT_KEY);
}
