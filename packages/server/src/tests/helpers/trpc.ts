import { AuthRole, type JWTPayload } from "@createrington/shared/auth";
import type { Context } from "@/trpc/context";

export const TEST_ADMIN: JWTPayload = {
  discordId: "100000000000000009",
  username: "admin",
  minecraftUsername: "Admin",
  minecraftUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  role: AuthRole.ADMIN,
  isAdmin: true,
};

export const TEST_USER: JWTPayload = {
  discordId: "100000000000000001",
  username: "steve",
  minecraftUsername: "Steve",
  minecraftUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: AuthRole.USER,
  isAdmin: false,
};

export function testContext(user: JWTPayload | null = null): Context {
  return { user, service: null, ip: "127.0.0.1" } satisfies Context;
}

export function adminContext(overrides: Partial<JWTPayload> = {}): Context {
  return testContext({ ...TEST_ADMIN, ...overrides });
}

export function userContext(overrides: Partial<JWTPayload> = {}): Context {
  return testContext({ ...TEST_USER, ...overrides });
}
