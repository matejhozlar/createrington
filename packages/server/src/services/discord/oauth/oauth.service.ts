import appConfig from "@/config";
import { Q } from "@/db";
import { safeAxiosError } from "@/utils/axios-error";
import axios from "axios";

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  verified?: boolean;
  global_name?: string;
}

export enum AuthRole {
  ADMIN = "admin",
  USER = "user",
  UNVERIFIED = "unverified",
}

export interface AuthenticatedUser {
  discordId: string;
  username: string;
  avatar?: string;
  role: AuthRole;
  isAdmin: boolean;
  minecraftUuid: string;
  minecraftUsername: string;
}

/**
 * Thrown by `authenticate` when the Discord account has no matching player
 * record. Distinct from generic auth failures so the callback can return a
 * targeted "not registered" response.
 */
export class UnverifiedUserError extends Error {
  constructor() {
    super("User is not a registered player");
    this.name = "UnverifiedUserError";
  }
}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Singleton wrapper around the Discord OAuth 2.0 endpoints used for user
 * login: authorize URL generation, code-for-token exchange, profile lookup,
 * refresh, and revoke. `authenticate` glues those steps together and resolves
 * the caller's application role (ADMIN / USER / UNVERIFIED) from the player
 * and admin tables, throwing `UnverifiedUserError` when the Discord account
 * has no matching player. Required env vars are validated at construction so
 * misconfiguration fails on first `getInstance` rather than at first login.
 */
export class DiscordOAuthService {
  private static instance: DiscordOAuthService;

  private readonly config: OAuthConfig;
  private readonly isDev = appConfig.envMode.isDev;

  private constructor() {
    this.config = appConfig.discord.oauth;
    this.validate();
  }

  /** Returns the singleton instance, creating (and validating env) on first call. */
  public static getInstance(): DiscordOAuthService {
    if (!DiscordOAuthService.instance) {
      DiscordOAuthService.instance = new DiscordOAuthService();
    }
    return DiscordOAuthService.instance;
  }

  private validate(): void {
    const missing: string[] = [];

    if (!this.config.clientId) missing.push("DISCORD_OAUTH_CLIENT_ID");
    if (!this.config.clientSecret) missing.push("DISCORD_OAUTH_CLIENT_SECRET");
    if (!this.config.redirectUri) {
      missing.push(
        this.isDev
          ? "DISCORD_OAUTH_REDIRECT_URI_DEV"
          : "DISCORD_OAUTH_REDIRECT_URI_PROD",
      );
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required Discord OAuth environment variables: ${missing.join(
          ", ",
        )}`,
      );
    }
  }

  /**
   * Exchanges an OAuth authorization code for Discord access/refresh tokens.
   * `redirectUriOverride` is required when the callback URL differs from the
   * default (e.g. sandbox / panel SSO consumers).
   */
  async exchange(
    code: string,
    redirectUriOverride?: string,
  ): Promise<DiscordTokenResponse> {
    try {
      const response = await axios.post<DiscordTokenResponse>(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUriOverride ?? this.config.redirectUri,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      logger.info("Successfully exchanged OAuth code for token");
      return response.data;
    } catch (error) {
      logger.error("Failed to exchange OAuth code:", safeAxiosError(error));
      throw new Error("Failed to exchange authorization code");
    }
  }

  /** Fetches the authenticated user's Discord profile (`/users/@me`). */
  async getUser(accessToken: string): Promise<DiscordUser> {
    try {
      const response = await axios.get<DiscordUser>(
        "https://discord.com/api/users/@me",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      logger.info(`Fetched Discord user ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error("Failed to fetch Discord user:", safeAxiosError(error));
      throw new Error("Failed to fetch user information");
    }
  }

  private async getAuthRole(discordId: string): Promise<AuthRole> {
    const playerExists = await Q.player.exists({ discordId });

    if (!playerExists) {
      return AuthRole.UNVERIFIED;
    }

    const isAdmin = await Q.admin.exists({ discordId });

    return isAdmin ? AuthRole.ADMIN : AuthRole.USER;
  }

  /**
   * Runs the full login pipeline (code exchange, profile fetch, role lookup,
   * player record join) and returns an `AuthenticatedUser`. Throws
   * `UnverifiedUserError` when the Discord account has no player record, so
   * callers can return a targeted "not registered" response rather than a
   * generic auth failure.
   */
  async authenticate(
    code: string,
    redirectUriOverride?: string,
  ): Promise<AuthenticatedUser> {
    const tokenData = await this.exchange(code, redirectUriOverride);
    const discordUser = await this.getUser(tokenData.access_token);
    const role = await this.getAuthRole(discordUser.id);

    if (role === AuthRole.UNVERIFIED) {
      throw new UnverifiedUserError();
    }

    const player = await Q.player.get({ discordId: discordUser.id });

    const authenticatedUser: AuthenticatedUser = {
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar || undefined,
      role,
      isAdmin: role === AuthRole.ADMIN,
      minecraftUuid: player.minecraftUuid,
      minecraftUsername: player.minecraftUsername,
    };

    logger.info(`Authenticated ${discordUser.id} as ${role}`);

    return authenticatedUser;
  }

  /** Builds the Discord authorize URL with the `identify` scope; `state` should be set for CSRF protection on web flows. */
  generateAuthUrl(state?: string, redirectUriOverride?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUriOverride ?? this.config.redirectUri,
      response_type: "code",
      scope: "identify",
    });

    if (state) {
      params.append("state", state);
    }

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /** Exchanges a Discord refresh token for a fresh access/refresh token pair. */
  async refresh(refreshToken: string): Promise<DiscordTokenResponse> {
    try {
      const response = await axios.post<DiscordTokenResponse>(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      logger.info("Successfully refreshed OAuth token");
      return response.data;
    } catch (error) {
      logger.error("Failed to refresh OAuth token:", safeAxiosError(error));
      throw new Error("Failed to refresh access token");
    }
  }

  /** Invalidates a Discord access or refresh token (called on logout). */
  async revoke(token: string): Promise<void> {
    try {
      await axios.post(
        "https://discord.com/api/oauth2/token/revoke",
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          token,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      logger.info("Successfully revoked OAuth token");
    } catch (error) {
      logger.error("Failed to revoke OAuth token:", safeAxiosError(error));
      throw new Error("Failed to revoke token");
    }
  }
}

export const discordOAuth = DiscordOAuthService.getInstance();
