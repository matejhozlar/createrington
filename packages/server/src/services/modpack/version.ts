const VERSION_RE = /^\d+(?:\.\d+)*$/;

// Refuses anything that is not purely dot-separated digits, so "not older" and "not comparable" both read false
export function isOlderVersion(version: string, other: string): boolean {
  if (!VERSION_RE.test(version) || !VERSION_RE.test(other)) {
    return false;
  }

  const parts = version.split(".").map(Number);
  const otherParts = other.split(".").map(Number);

  for (let i = 0; i < Math.max(parts.length, otherParts.length); i++) {
    const diff = (parts[i] ?? 0) - (otherParts[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }

  return false;
}
