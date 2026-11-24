export const MAX_TIMEOUT_MS = 2_147_483_647;

export interface LongTimeout {
  clear(): void;
}

export function setLongTimeout(
  callback: () => void,
  delayMs: number,
): LongTimeout {
  const target = Date.now() + Math.max(0, delayMs);
  let handle: NodeJS.Timeout;

  const arm = () => {
    const remaining = target - Date.now();
    handle =
      remaining > MAX_TIMEOUT_MS
        ? setTimeout(arm, MAX_TIMEOUT_MS)
        : setTimeout(callback, Math.max(0, remaining));
  };
  arm();

  return { clear: () => clearTimeout(handle) };
}
