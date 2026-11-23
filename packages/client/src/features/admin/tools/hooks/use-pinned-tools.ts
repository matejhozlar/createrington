import { useState } from "react";
import { localStore } from "@/lib/storage";

const STORAGE_KEY = "admin-tools-pins";

export const MAX_PINNED_TOOLS = 4;

function readPins(validHrefs: string[]): string[] {
  const stored = localStore.getJson(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((href): href is string => validHrefs.includes(href))
    .slice(0, MAX_PINNED_TOOLS);
}

export function usePinnedTools(validHrefs: string[]) {
  const [pinned, setPinned] = useState(() => readPins(validHrefs));

  const togglePin = (href: string) => {
    const next = pinned.includes(href)
      ? pinned.filter((entry) => entry !== href)
      : [...pinned, href];
    if (next.length > MAX_PINNED_TOOLS) return false;
    localStore.setJson(STORAGE_KEY, next);
    setPinned(next);
    return true;
  };

  return [pinned, togglePin] as const;
}
