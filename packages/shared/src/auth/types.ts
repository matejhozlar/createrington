export enum AuthRole {
  ADMIN = "admin",
  USER = "user",
  UNVERIFIED = "unverified",
}

export interface JWTPayload {
  discordId: string;
  username: string;
  avatar?: string;
  role: AuthRole;
  isAdmin: boolean;
  minecraftUuid: string;
  minecraftUsername: string;
}

export interface RefreshResponse {
  accessToken: string;
  user: JWTPayload;
}
