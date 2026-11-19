import { compareVersions } from "@/utils/version";

const VERSION_RE = /^\d+(?:\.\d+)*$/;

export function isOlderVersion(version: string, other: string): boolean {
  if (!VERSION_RE.test(version) || !VERSION_RE.test(other)) {
    return false;
  }
  return compareVersions(version, other) < 0;
}
