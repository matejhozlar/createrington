import appConfig from "@/config";
import { Q } from "@/db";
import axios, { AxiosError } from "axios";

/** Extract safe error details from Axios errors without leaking secrets */
function safeAxiosError(error: unknown): object {
  if (error instanceof AxiosError) {
    return {
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code,
      message: error.message,
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * Discord OAuth token response
 */
interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Discord user object from API
 */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  verified?: boolean;
  global_name?: string;
}

/**
 * User role type
 */
export enum AuthRole {
  ADMIN = "admin",
  USER = "user",
  UNVERIFIED = "unverified",
}

/**
 * Authenticated user data
 */
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
 * Discord OAuth configuration
 */
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Discord OAuth Service
 *
 * Handles all Discord OAuth 2.0 flows for user authentication:
 * - Generates authorization URLs with the correct scopes and optional CSRF state
 * - Exchanges authorization codes for Discord access and refresh tokens
 * - Fetches the authenticated user's Discord profile from the API
 * - Determines each user's application role (ADMIN / USER / UNVERIFIED)
 * - Orchestrates the full login flow into a single `authenticate` call
 * - Refreshes and revokes Discord OAuth tokens as needed
 *
 * NOTE: Validates that all required OAuth environment variables are present
 * at construction time — misconfiguration throws immediately rather than at runtime
 */
export class DiscordOAuthService {
  private static instance: DiscordOAuthService;

  private readonly config: OAuthConfig;
  private readonly isDev = appConfig.envMode.isDev;

  private constructor() {
    this.config = appConfig.discord.oauth;
    this.validate();
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /** Returns the singleton instance, creating it on first call */
  public static getInstance(): DiscordOAuthService {
    if (!DiscordOAuthService.instance) {
      DiscordOAuthService.instance = new DiscordOAuthService();
    }
    return DiscordOAuthService.instance;
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Validate that all required OAuth configuration values are present
   *
   * @throws Error if any required environment variables are missing
   * @private
   */
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

  // ==========================================================================
  // TOKEN EXCHANGE
  // ==========================================================================

  /**
   * Exchange an authorization code for a Discord access token
   *
   * This is the second step in the OAuth2 flow, where the authorization code
   * received from Discord is exchanged for an access token and refresh token.
   *
   * @param code - The authorization code from the Discord OAuth callback
   * @returns Promise containing the access token, refresh token, and token metadata
   * @throws Error if the token exchange fails
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

  // ==========================================================================
  // USER DATA
  // ==========================================================================

  /**
   * Fetch Discord user information using an access token
   *
   * Calls the Discord API to retrieve the authenticated user's profile data.
   *
   * @param accessToken - Valid Discord OAuth access token
   * @returns Promise containing the Discord user object
   * @throws Error if the API request fails
   */
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

      logger.info(
        `Fetched Discord user: ${response.data.username} (${response.data.id})`,
      );
      return response.data;
    } catch (error) {
      logger.error("Failed to fetch Discord user:", safeAxiosError(error));
      throw new Error("Failed to fetch user information");
    }
  }

  /**
   * Determines the user's role based on their Discord ID
   *
   * Checks the database to see if the user is a player and/or admin:
   * - UNVERIFIED: User is not in the player database
   * - USER: User exists as a player but is not an admin
   * - ADMIN: User exists as both a player and an admin
   *
   * @param discordId - The Discord user ID to check
   * @returns Promise resolving to the user's role
   *
   * @private
   */
  private async getAuthRole(discordId: string): Promise<AuthRole> {
    const playerExists = await Q.player.exists({ discordId });

    if (!playerExists) {
      return AuthRole.UNVERIFIED;
    }

    const isAdmin = await Q.admin.exists({ discordId });

    return isAdmin ? AuthRole.ADMIN : AuthRole.USER;
  }

  /**
   * Complete authentication flow for a user
   *
   * This is the main authentication method that:
   * 1. Exchanges the authorization code for an access token
   * 2. Fetches the user's Discord profile
   * 3. Determines their role in the application
   * 4. Returns a unified authenticated user object
   *
   * @param code - Authorization code from Discord OAuth callback
   * @returns Promise containing the authenticated user data
   * @throws Error if any step of the authentication fails
   */
  async authenticate(
    code: string,
    redirectUriOverride?: string,
  ): Promise<AuthenticatedUser> {
    const tokenData = await this.exchange(code, redirectUriOverride);
    const discordUser = await this.getUser(tokenData.access_token);
    const role = await this.getAuthRole(discordUser.id);

    if (role === AuthRole.UNVERIFIED) {
      throw new Error("Authentication failed");
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

    logger.info(
      `Authenticated ${player.minecraftUsername} (${discordUser.username}) as ${role}`,
    );

    return authenticatedUser;
  }

  // ==========================================================================
  // AUTHORIZATION
  // ==========================================================================

  /**
   * Generate a Discord OAuth authorization URL
   *
   * Creates the URL that users are redirected to in order to authorize the
   * application. Includes the client ID, redirect URI, and `identify` scope.
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns The complete Discord authorization URL
   */
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

  /**
   * Refresh an expired access token using a refresh token
   *
   * OAuth access tokens expire after a certain time. This method uses the
   * refresh token to obtain a new access token without requiring the user
   * to re-authorize the application.
   *
   * @param refreshToken - The refresh token from a previous token response
   * @returns Promise containing new access token and refresh token
   * @throws Error if the refresh fails
   */
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

  /**
   * Revoke an access or refresh token
   *
   * This invalidates a token, typically used during logout to ensure
   * the token can no longer be used to access the user's account.
   *
   * @param token - The access token or refresh token to revoke
   * @throws Error if the revocation fails
   */
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
