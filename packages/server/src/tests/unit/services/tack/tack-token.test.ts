import { describe, it, expect } from "vitest";
import { jwtVerify } from "jose";
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

async function verify(token: string, secret = TACK.secret) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
  });
  return payload;
}

describe("signTackToken", () => {
  it("signs with the whole secret, prefix included", async () => {
    const token = await signTackToken(USER, TACK);

    await expect(verify(token)).resolves.toBeDefined();
    await expect(
      verify(token, TACK.secret.replace("tack_sk_", "")),
    ).rejects.toThrow();
  });

  it("names the session's Discord user as subject with a Discord avatar", async () => {
    const claims = await verify(await signTackToken(USER, TACK));

    expect(claims.sub).toBe(USER.discordId);
    expect(claims.name).toBe("Steve");
    expect(claims.avatar).toBe(
      "https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3.png?size=128",
    );
  });

  it("expires after the configured lifetime", async () => {
    const claims = await verify(await signTackToken(USER, TACK));

    expect(claims.exp! - claims.iat!).toBe(TACK.tokenTtlSeconds);
  });

  it("falls back to the Discord username and caps the name at 64 characters", async () => {
    const claims = await verify(
      await signTackToken(
        { ...USER, minecraftUsername: "", username: "x".repeat(80) },
        TACK,
      ),
    );

    expect(claims.name).toBe("x".repeat(64));
  });
});
