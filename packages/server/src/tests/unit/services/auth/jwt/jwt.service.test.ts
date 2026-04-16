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

import { JWTService } from "@/services/auth/jwt/jwt.service";
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
    service = JWTService.getInstance();
  });

  it("getInstance returns a stable singleton", () => {
    expect(JWTService.getInstance()).toBe(service);
  });

  describe("generate", () => {
    it("returns a token that decodes back to the input payload", () => {
      const token = service.generate(baseUser);
      const decoded = service.verify(token);

      expect(decoded.discordId).toBe(baseUser.discordId);
      expect(decoded.username).toBe(baseUser.username);
      expect(decoded.role).toBe(baseUser.role);
      expect(decoded.isAdmin).toBe(baseUser.isAdmin);
      expect(decoded.minecraftUuid).toBe(baseUser.minecraftUuid);
      expect(decoded.minecraftUsername).toBe(baseUser.minecraftUsername);
    });

    it("includes the avatar field only when provided", () => {
      const withAvatar = service.verify(
        service.generate({ ...baseUser, avatar: "abc.png" }),
      );
      expect(withAvatar.avatar).toBe("abc.png");

      const without = service.verify(service.generate(baseUser));
      expect(without.avatar).toBeUndefined();
    });

    it("uses HS256 (does not accept tampered tokens)", () => {
      const token = service.generate(baseUser);
      // Flip a character in the signature segment to invalidate it
      const [header, payload, signature] = token.split(".");
      const tampered = `${header}.${payload}.${signature.slice(0, -1)}${
        signature.slice(-1) === "A" ? "B" : "A"
      }`;
      expect(() => service.verify(tampered)).toThrow("Invalid token");
    });
  });

  describe("generateFromPayload", () => {
    it("round-trips a JWTPayload", () => {
      const payload: JWTPayload = {
        discordId: "999",
        username: "bob",
        role: AuthRole.ADMIN,
        isAdmin: true,
        minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
        minecraftUsername: "Bob_MC",
      };
      const token = service.generateFromPayload(payload);
      const decoded = service.verify(token);
      expect(decoded.discordId).toBe(payload.discordId);
      expect(decoded.role).toBe(AuthRole.ADMIN);
      expect(decoded.isAdmin).toBe(true);
    });

    it("preserves the avatar when provided", () => {
      const decoded = service.verify(
        service.generateFromPayload({
          ...baseUser,
          role: AuthRole.USER,
          avatar: "x.png",
        }),
      );
      expect(decoded.avatar).toBe("x.png");
    });
  });

  describe("verify", () => {
    it("throws 'Invalid token' for syntactically broken input", () => {
      expect(() => service.verify("not-a-token")).toThrow("Invalid token");
    });

    it("throws 'Invalid token' for tokens signed with a different secret", () => {
      const otherToken = signWithSecret(baseUser, "different-secret");
      expect(() => service.verify(otherToken)).toThrow("Invalid token");
    });
  });

  describe("decode", () => {
    it("returns the payload without verifying the signature", () => {
      const token = service.generate(baseUser);
      const decoded = service.decode(token);
      expect(decoded?.discordId).toBe(baseUser.discordId);
    });

    it("returns null for malformed input", () => {
      expect(service.decode("garbage")).toBeNull();
    });
  });
});

// Helper: sign a token with a different secret (without going through the service)
function signWithSecret(user: AuthenticatedUser, secret: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    {
      discordId: user.discordId,
      username: user.username,
      role: user.role,
      isAdmin: user.isAdmin,
      minecraftUuid: user.minecraftUuid,
      minecraftUsername: user.minecraftUsername,
    },
    secret,
    { algorithm: "HS256", expiresIn: "15m" },
  );
}
