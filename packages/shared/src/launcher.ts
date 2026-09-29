export const LAUNCHER_RELEASE_STATUSES = [
  "pending",
  "released",
  "withdrawn",
] as const;

export type LauncherReleaseStatus = (typeof LAUNCHER_RELEASE_STATUSES)[number];

export const LAUNCHER_CHANNELS = ["staging", "production"] as const;

export type LauncherChannel = (typeof LAUNCHER_CHANNELS)[number];

export const LAUNCHER_PLATFORMS = ["windows-x86_64"] as const;

export type LauncherPlatform = (typeof LAUNCHER_PLATFORMS)[number];

export const LAUNCHER_RELEASE_NOTES_MAX_LENGTH = 10_000;
