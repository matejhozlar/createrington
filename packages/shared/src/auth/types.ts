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

export interface AuthSession {
  accessToken: string;
  user: JWTPayload;
}

export interface DiscordAuthUrl {
  url: string;
  state: string;
}
