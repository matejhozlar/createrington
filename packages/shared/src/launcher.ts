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

export const LAUNCHER_VERSION_HEADER = "X-Launcher-Version";

export const LAUNCHER_PLATFORM_HEADER = "X-Launcher-Platform";

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

export const LAUNCHER_CONTENT_SOURCES = ["curseforge", "modrinth"] as const;

export type LauncherContentSource = (typeof LAUNCHER_CONTENT_SOURCES)[number];

export const LAUNCHER_CONTENT_KINDS = [
  "mod",
  "resourcepack",
  "shader",
] as const;

export type LauncherContentKind = (typeof LAUNCHER_CONTENT_KINDS)[number];

export const LAUNCHER_CONTENT_LOADERS = [
  "neoforge",
  "forge",
  "fabric",
  "quilt",
] as const;

export type LauncherContentLoader = (typeof LAUNCHER_CONTENT_LOADERS)[number];

export const LAUNCHER_CONTENT_RELEASE_TYPES = [
  "release",
  "beta",
  "alpha",
] as const;

export type LauncherContentReleaseType =
  (typeof LAUNCHER_CONTENT_RELEASE_TYPES)[number];

export const LAUNCHER_CONTENT_SORTS = [
  "relevance",
  "downloads",
  "newest",
  "updated",
] as const;

export type LauncherContentSort = (typeof LAUNCHER_CONTENT_SORTS)[number];

export const LAUNCHER_CONTENT_CATEGORIES_MAX = 10;

export const LAUNCHER_CONTENT_PAGE_SIZE = 20;

export const LAUNCHER_CONTENT_MAX_PAGE_SIZE = 50;

export const LAUNCHER_CONTENT_MAX_RESULTS = 10_000;

export const LAUNCHER_CONTENT_SEARCH_MAX_LENGTH = 100;

export const LAUNCHER_CONTENT_PROJECTS_MAX = 100;

export const LAUNCHER_CONTENT_FINGERPRINTS_MAX = 1000;

export const LAUNCHER_CONTENT_FINGERPRINT_MAX_VALUE = 4_294_967_295;

export const LauncherContentErrorCode = {
  CONTENT_UNAVAILABLE: "CONTENT_UNAVAILABLE",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
} as const;

export type LauncherContentErrorCode =
  (typeof LauncherContentErrorCode)[keyof typeof LauncherContentErrorCode];

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
  UPDATE_REQUIRED: "UPDATE_REQUIRED",
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

export const LAUNCHER_PACK_RELEASES_PAGE_SIZE = 10;

export const LAUNCHER_PACK_RELEASES_MAX_PAGE_SIZE = 25;

export interface LauncherPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LauncherPackReleasesData {
  releases: LauncherPackRelease[];
  pagination: LauncherPagination;
}

export interface LauncherProjectLatestFile {
  fileId: string;
  fileName: string;
  gameVersion: string;
  loader: LauncherContentLoader | null;
  releaseType: LauncherContentReleaseType;
}

export interface LauncherProject {
  source: LauncherContentSource;
  id: string;
  slug: string;
  kind: LauncherContentKind;
  name: string;
  summary: string | null;
  author: string | null;
  iconUrl: string | null;
  url: string;
  latestFiles?: LauncherProjectLatestFile[];
}

export interface LauncherContentDownload {
  servedBy: LauncherPackFileSource;
  url: string | null;
}

export interface LauncherContentFile {
  source: LauncherContentSource;
  projectId: string;
  id: string;
  fileName: string;
  size: number;
  sha1: string;
  pageUrl: string;
  download: LauncherContentDownload;
}

export interface LauncherContentDependency {
  source: LauncherContentSource;
  projectId: string;
  required: boolean;
}

export interface LauncherContentFileDetails extends LauncherContentFile {
  displayName: string;
  releaseType: LauncherContentReleaseType;
  publishedAt: string | null;
  gameVersions: string[];
  loaders: LauncherContentLoader[];
  dependencies: LauncherContentDependency[];
}

export interface LauncherProjectHit extends LauncherProject {
  downloads: number;
}

export interface LauncherContentSearchData {
  projects: LauncherProjectHit[];
  pagination: LauncherPagination;
}

export interface LauncherContentCategory {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  parentId: string | null;
}

export interface LauncherContentCategoriesData {
  categories: LauncherContentCategory[];
}

export interface LauncherContentProjectsData {
  projects: LauncherProject[];
  unknownProjectIds: string[];
}

export interface LauncherContentFilesData {
  files: LauncherContentFileDetails[];
  pagination: LauncherPagination;
}

export interface LauncherContentFileData {
  file: LauncherContentFileDetails;
}

export interface LauncherContentFingerprintMatch {
  fingerprint: number;
  project: LauncherProject;
  file: LauncherContentFileDetails;
}

export interface LauncherContentFingerprintsData {
  matches: LauncherContentFingerprintMatch[];
  unmatchedFingerprints: number[];
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
  file: LauncherContentFile;
  project: LauncherProject;
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
    code?:
      LauncherAuthErrorCode | LauncherPackErrorCode | LauncherContentErrorCode;
    details?: unknown;
    stack?: string;
  };
}
