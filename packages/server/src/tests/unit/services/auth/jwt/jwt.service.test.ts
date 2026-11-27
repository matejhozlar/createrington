import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the config so the singleton constructs deterministically.
// Hoisted by Vitest so it applies before the module under test is imported.
vi.mock("@/config", () => ({
  default: {
    app: {
      auth: {
        accessToken: {
          secret: "test-secret-please-do-not-use-in-prod",
          expiresIn: "15m",
        },
      },
    },
  },
}));

import { signTestJwt } from "@/tests/helpers/jwt";
import {
  JWTService,
  JWT_AUDIENCE_WEB,
  TokenExpiredError,
} from "@/services/auth/jwt/jwt.service";
import { AuthRole } from "@createrington/shared/auth";
import type { AuthenticatedUser } from "@/services/discord/oauth/oauth.service";
import type { JWTPayload } from "@createrington/shared/auth";

const baseUser: AuthenticatedUser = {
  discordId: "123",
  username: "alice",
  role: AuthRole.USER,
  isAdmin: false,
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
};

describe("JWTService", () => {
  let service: JWTService;

  beforeEach(() => {
    service = new JWTService();
  });

  describe("generate", () => {
    it("returns a token that decodes back to the input payload", async () => {
      const token = await service.generate(baseUser);
      const decoded = await service.verify(token);

      expect(decoded.discordId).toBe(baseUser.discordId);
      expect(decoded.username).toBe(baseUser.username);
      expect(decoded.role).toBe(baseUser.role);
      expect(decoded.isAdmin).toBe(baseUser.isAdmin);
      expect(decoded.minecraftUuid).toBe(baseUser.minecraftUuid);
      expect(decoded.minecraftUsername).toBe(baseUser.minecraftUsername);
    });

    it("includes the avatar field only when provided", async () => {
      const withAvatar = await service.verify(
        await service.generate({ ...baseUser, avatar: "abc.png" }),
      );
      expect(withAvatar.avatar).toBe("abc.png");

      const without = await service.verify(await service.generate(baseUser));
      expect(without.avatar).toBeUndefined();
    });

    it("uses HS256 (does not accept tampered tokens)", async () => {
      const token = await service.generate(baseUser);
      // Flip a character in the signature segment to invalidate it
      const [header, payload, signature] = token.split(".");
      const tampered = `${header}.${payload}.${signature.slice(0, -1)}${
        signature.slice(-1) === "A" ? "B" : "A"
      }`;
      await expect(service.verify(tampered)).rejects.toThrow("Invalid token");
    });
  });

  describe("generateFromPayload", () => {
    it("round-trips a JWTPayload", async () => {
      const payload: JWTPayload = {
        discordId: "999",
        username: "bob",
        role: AuthRole.ADMIN,
        isAdmin: true,
        minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
        minecraftUsername: "Bob_MC",
      };
      const token = await service.generateFromPayload(payload);
      const decoded = await service.verify(token);
      expect(decoded.discordId).toBe(payload.discordId);
      expect(decoded.role).toBe(AuthRole.ADMIN);
      expect(decoded.isAdmin).toBe(true);
    });

    it("preserves the avatar when provided", async () => {
      const decoded = await service.verify(
        await service.generateFromPayload({
          ...baseUser,
          role: AuthRole.USER,
          avatar: "x.png",
        }),
      );
      expect(decoded.avatar).toBe("x.png");
    });
  });

  describe("verify", () => {
    it("throws 'Invalid token' for syntactically broken input", async () => {
      await expect(service.verify("not-a-token")).rejects.toThrow(
        "Invalid token",
      );
    });

    it("throws 'Invalid token' for tokens signed with a different secret", async () => {
      const otherToken = await signWithSecret(baseUser, "different-secret");
      await expect(service.verify(otherToken)).rejects.toThrow("Invalid token");
    });

    it("rejects a mod-signed token even though the secret matches", async () => {
      const modToken = await signModToken({
        uuid: baseUser.minecraftUuid,
        name: baseUser.minecraftUsername,
      });
      await expect(service.verify(modToken)).rejects.toThrow("Invalid token");
    });

    it("throws TokenExpiredError for an expired web token", async () => {
      const expired = await signTestJwt(baseUser, TEST_SECRET, {
        audience: JWT_AUDIENCE_WEB,
        expiresInSeconds: -10,
      });
      await expect(service.verify(expired)).rejects.toThrow(TokenExpiredError);
    });

    it("rejects a web-audience token with a malformed payload", async () => {
      const bogus = await signAsWeb({ discordId: "x" });
      await expect(service.verify(bogus)).rejects.toThrow(
        "Invalid token payload",
      );
    });

    it("rejects a web-audience token with wrong field types", async () => {
      const bogus = await signAsWeb({
        discordId: "x",
        username: "y",
        role: "user",
        isAdmin: "yes",
        minecraftUuid: "u",
        minecraftUsername: "n",
      });
      await expect(service.verify(bogus)).rejects.toThrow(
        "Invalid token payload",
      );
    });
  });
});

const TEST_SECRET = "test-secret-please-do-not-use-in-prod";

// Helper: sign a token with a different secret (without going through the service)
function signWithSecret(
  user: AuthenticatedUser,
  secret: string,
): Promise<string> {
  return signTestJwt(
    {
      discordId: user.discordId,
      username: user.username,
      role: user.role,
      isAdmin: user.isAdmin,
      minecraftUuid: user.minecraftUuid,
      minecraftUsername: user.minecraftUsername,
    },
    secret,
    { expiresInSeconds: 900 },
  );
}

function signModToken(payload: {
  uuid: string;
  name: string;
}): Promise<string> {
  return signTestJwt(payload, TEST_SECRET, {
    audience: "createrington.mod",
    expiresInSeconds: 60,
  });
}

function signAsWeb(payload: Record<string, unknown>): Promise<string> {
  return signTestJwt(payload, TEST_SECRET, {
    audience: "createrington.web",
    expiresInSeconds: 900,
  });
}
