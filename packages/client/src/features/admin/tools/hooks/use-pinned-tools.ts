import { useState } from "react";

const STORAGE_KEY = "admin-tools-pins";

export const MAX_PINNED_TOOLS = 4;

function readPins(validHrefs: string[]): string[] {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((href): href is string => validHrefs.includes(href))
      .slice(0, MAX_PINNED_TOOLS);
  } catch {
    return [];
  }
}

function writePins(pins: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    return;
  }
}

export function usePinnedTools(validHrefs: string[]) {
  const [pinned, setPinned] = useState(() => readPins(validHrefs));

  const togglePin = (href: string) => {
    const next = pinned.includes(href)
      ? pinned.filter((entry) => entry !== href)
      : [...pinned, href];
    if (next.length > MAX_PINNED_TOOLS) return false;
    writePins(next);
    setPinned(next);
    return true;
  };

  return [pinned, togglePin] as const;
}
