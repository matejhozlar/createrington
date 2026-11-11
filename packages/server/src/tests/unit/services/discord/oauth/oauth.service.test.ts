import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestedUrl } from "@/tests/helpers/fetch";

vi.mock("@/config", () => ({
  default: {
    discord: {
      oauth: {
        clientId: "1234567890",
        clientSecret: "client-secret",
        redirectUri: "https://createrington.test/api/auth/callback",
      },
    },
  },
}));
vi.mock("@/db", () => ({ Q: {} }));

const { discordOAuth } = await import("@/services/discord/oauth/oauth.service");

const fetchMock = vi.fn<typeof fetch>();

const TOKENS = {
  access_token: "access",
  token_type: "Bearer",
  expires_in: 604800,
  refresh_token: "refresh",
  scope: "identify",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function sentForm(call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call]?.[1];
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("Content-Type")).toBe(
    "application/x-www-form-urlencoded",
  );
  return Object.fromEntries(init?.body as URLSearchParams);
}

describe("DiscordOAuthService", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exchanges a code for tokens with the default redirect uri", async () => {
    fetchMock.mockResolvedValueOnce(json(TOKENS));

    await expect(discordOAuth.exchange("the-code")).resolves.toEqual(TOKENS);

    expect(requestedUrl(fetchMock).href).toBe(
      "https://discord.com/api/oauth2/token",
    );
    expect(sentForm()).toEqual({
      client_id: "1234567890",
      client_secret: "client-secret",
      grant_type: "authorization_code",
      code: "the-code",
      redirect_uri: "https://createrington.test/api/auth/callback",
    });
  });

  it("uses the redirect uri override of an SSO consumer", async () => {
    fetchMock.mockResolvedValueOnce(json(TOKENS));

    await discordOAuth.exchange("the-code", "https://sandbox.test/callback");

    expect(sentForm().redirect_uri).toBe("https://sandbox.test/callback");
  });

  it("hides the Discord answer behind a generic error when the exchange is refused", async () => {
    const logged = vi.spyOn(logger, "error").mockImplementation(() => logger);
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));

    await expect(discordOAuth.exchange("used-code")).rejects.toThrow(
      "Failed to exchange authorization code",
    );

    expect(logged).toHaveBeenCalledExactlyOnceWith(
      "Failed to exchange OAuth code:",
      expect.objectContaining({ status: 400 }),
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain("client-secret");
  });

  it("fetches the profile with the access token", async () => {
    const user = { id: "42", username: "matej", discriminator: "0" };
    fetchMock.mockResolvedValueOnce(json(user));

    await expect(discordOAuth.getUser("access")).resolves.toEqual(user);

    expect(requestedUrl(fetchMock).href).toBe(
      "https://discord.com/api/users/@me",
    );
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer access",
    );
  });

  it("fails the profile lookup when Discord rejects the token", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => logger);
    fetchMock.mockResolvedValueOnce(
      json({ message: "401: Unauthorized" }, 401),
    );

    await expect(discordOAuth.getUser("expired")).rejects.toThrow(
      "Failed to fetch user information",
    );
  });

  it("refreshes a token pair", async () => {
    fetchMock.mockResolvedValueOnce(json(TOKENS));

    await expect(discordOAuth.refresh("old-refresh")).resolves.toEqual(TOKENS);

    expect(sentForm()).toEqual({
      client_id: "1234567890",
      client_secret: "client-secret",
      grant_type: "refresh_token",
      refresh_token: "old-refresh",
    });
  });

  it("revokes a token", async () => {
    fetchMock.mockResolvedValueOnce(json({}));

    await expect(discordOAuth.revoke("access")).resolves.toBeUndefined();

    expect(requestedUrl(fetchMock).href).toBe(
      "https://discord.com/api/oauth2/token/revoke",
    );
    expect(sentForm()).toEqual({
      client_id: "1234567890",
      client_secret: "client-secret",
      token: "access",
    });
  });

  it("fails the revoke when Discord cannot be reached", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => logger);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(discordOAuth.revoke("access")).rejects.toThrow(
      "Failed to revoke token",
    );
  });
});
