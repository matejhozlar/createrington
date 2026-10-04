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

export const LAUNCHER_RELEASE_CHANGES_MAX = 500;

export const LAUNCHER_RELEASE_CHANGE_TYPE_MAX_LENGTH = 32;

export interface LauncherReleaseChange {
  type: string;
  title: string;
  description: string;
}

export interface LauncherStructuredNotes {
  summary: string;
  changes: LauncherReleaseChange[];
}

export const LAUNCHER_PACK_FILE_SOURCES = [
  "curseforge",
  "modrinth",
  "curseforge-cdn",
  "storage",
  "manual",
] as const;

export type LauncherPackFileSource =
  (typeof LAUNCHER_PACK_FILE_SOURCES)[number];

export const LAUNCHER_PACK_FOLDERS = [
  "mods",
  "resourcepacks",
  "shaderpacks",
] as const;

export type LauncherPackFolder = (typeof LAUNCHER_PACK_FOLDERS)[number];

export const LAUNCHER_PACK_RESOLVE_MAX_FILES = 1000;

export const LauncherPackErrorCode = {
  PACK_UNAVAILABLE: "PACK_UNAVAILABLE",
  FILE_SOURCES_UNAVAILABLE: "FILE_SOURCES_UNAVAILABLE",
} as const;

export type LauncherPackErrorCode =
  (typeof LauncherPackErrorCode)[keyof typeof LauncherPackErrorCode];

export const LauncherAuthErrorCode = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  INVALID_CHALLENGE: "INVALID_CHALLENGE",
  INVALID_CLAIM: "INVALID_CLAIM",
  NOT_A_MEMBER: "NOT_A_MEMBER",
  BANNED: "BANNED",
  INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN",
  MOJANG_UNAVAILABLE: "MOJANG_UNAVAILABLE",
} as const;

export type LauncherAuthErrorCode =
  (typeof LauncherAuthErrorCode)[keyof typeof LauncherAuthErrorCode];

export interface LauncherPlayer {
  minecraftUuid: string;
  minecraftUsername: string;
}

export interface LauncherChallengeData {
  serverId: string;
  expiresIn: number;
}

export interface LauncherSessionData {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  player: LauncherPlayer;
}

export interface LauncherMeData {
  player: LauncherPlayer;
}

export interface LauncherPackData {
  version: string;
  releasedAt: string | null;
  minecraftVersion: string;
  modLoader: {
    id: string;
    name: string;
    version: string;
  };
  javaMajorVersion: number;
  zip: {
    fileId: number;
    fileName: string;
    url: string;
    size: number;
    sha1: string;
  };
}

export interface LauncherPackChangelogEntry {
  projectId: number;
  name: string;
  url: string | null;
  iconUrl: string | null;
  label: string;
  previousLabel: string | null;
  disabled: boolean;
}

export interface LauncherPackChangelog {
  previousVersion: string | null;
  added: LauncherPackChangelogEntry[];
  updated: LauncherPackChangelogEntry[];
  removed: LauncherPackChangelogEntry[];
  notes: string | null;
}

export interface LauncherPackRelease extends LauncherPackData {
  changelog: LauncherPackChangelog;
}

export interface LauncherPackReleasesData {
  releases: LauncherPackRelease[];
}

export interface LauncherPackFile {
  projectId: number;
  fileId: number;
  fileName: string;
  size: number;
  sha1: string;
  folder: LauncherPackFolder;
  source: LauncherPackFileSource;
  url: string | null;
  pageUrl: string;
}

export interface LauncherPackFilesData {
  files: LauncherPackFile[];
  unresolvedFileIds: number[];
}

export interface LauncherSuccessResponse<T> {
  success: true;
  data: T;
}

export interface LauncherLogoutResponse {
  success: true;
  message: string;
}

export interface LauncherErrorResponse {
  success: false;
  message: string;
  playerMessage?: string;
  error: {
    message: string;
    statusCode: number;
    code?: LauncherAuthErrorCode | LauncherPackErrorCode;
    details?: unknown;
    stack?: string;
  };
}
