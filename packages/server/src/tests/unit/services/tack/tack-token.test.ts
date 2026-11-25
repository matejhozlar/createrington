import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";
import { signTackToken } from "@/services/tack";

const TACK = {
  secret: "tack_sk_0123456789abcdefghijklmnopqrstuv",
  tokenTtlSeconds: 15 * 60,
};

const USER: JWTPayload = {
  discordId: "123456789012345678",
  username: "discorduser",
  avatar: "a1b2c3",
  role: AuthRole.ADMIN,
  isAdmin: true,
  minecraftUuid: "00000000-0000-0000-0000-000000000000",
  minecraftUsername: "Steve",
};

function verify(token: string, secret = TACK.secret) {
  return jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
}

describe("signTackToken", () => {
  it("signs with the whole secret, prefix included", () => {
    const token = signTackToken(USER, TACK);

    expect(() => verify(token)).not.toThrow();
    expect(() => verify(token, TACK.secret.replace("tack_sk_", ""))).toThrow();
  });

  it("names the session's Discord user as subject with a Discord avatar", () => {
    const claims = verify(signTackToken(USER, TACK));

    expect(claims.sub).toBe(USER.discordId);
    expect(claims.name).toBe("Steve");
    expect(claims.avatar).toBe(
      "https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3.png?size=128",
    );
  });

  it("expires after the configured lifetime", () => {
    const claims = verify(signTackToken(USER, TACK));

    expect(claims.exp! - claims.iat!).toBe(TACK.tokenTtlSeconds);
  });

  it("falls back to the Discord username and caps the name at 64 characters", () => {
    const claims = verify(
      signTackToken(
        { ...USER, minecraftUsername: "", username: "x".repeat(80) },
        TACK,
      ),
    );

    expect(claims.name).toBe("x".repeat(64));
  });
});
