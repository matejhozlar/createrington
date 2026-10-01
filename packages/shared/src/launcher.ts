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
  error: {
    message: string;
    statusCode: number;
    code?: LauncherAuthErrorCode;
  };
}
