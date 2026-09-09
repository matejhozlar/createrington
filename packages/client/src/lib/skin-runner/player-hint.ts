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
  try {
    const raw = localStorage.getItem(PLAYER_HINT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isPlayerHint(parsed) ? parsed : DEFAULT_PLAYER;
  } catch {
    return DEFAULT_PLAYER;
  }
}

export function writePlayerHint(hint: PlayerHint | null): void {
  try {
    if (hint) {
      localStorage.setItem(PLAYER_HINT_KEY, JSON.stringify(hint));
    } else {
      localStorage.removeItem(PLAYER_HINT_KEY);
    }
  } catch {
    return;
  }
}
