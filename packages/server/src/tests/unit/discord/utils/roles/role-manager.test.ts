import { describe, it, expect, beforeEach } from "vitest";
import { Collection } from "discord.js";
import type { GuildMember, Role } from "discord.js";
import { RoleManager } from "@/discord/utils/roles/role-manager";

const GUILD_ID = "guild-1";
// In Discord, the @everyone role's ID equals the guild ID — getAll/getRoles
// rely on that to exclude it from results.
const EVERYONE_ROLE_ID = GUILD_ID;

const role = (id: string, name = `role-${id}`): Role =>
  ({ id, name }) as unknown as Role;

const memberWithRoles = (roleIds: string[]): GuildMember => {
  const cache = new Collection<string, Role>();
  cache.set(EVERYONE_ROLE_ID, role(EVERYONE_ROLE_ID, "@everyone"));
  for (const id of roleIds) cache.set(id, role(id));

  return {
    guild: { id: GUILD_ID },
    roles: { cache },
  } as unknown as GuildMember;
};

describe("RoleManager (read methods)", () => {
  let member: GuildMember;

  beforeEach(() => {
    member = memberWithRoles(["role-A", "role-B"]);
  });

  describe("has", () => {
    it("returns true when the member has the role", () => {
      expect(RoleManager.has(member, "role-A")).toBe(true);
    });

    it("returns false when the member does not have the role", () => {
      expect(RoleManager.has(member, "role-Z")).toBe(false);
    });
  });

  describe("hasAny", () => {
    it("returns true when at least one role matches", () => {
      expect(RoleManager.hasAny(member, ["role-Z", "role-B"])).toBe(true);
    });

    it("returns false when no roles match", () => {
      expect(RoleManager.hasAny(member, ["role-X", "role-Y"])).toBe(false);
    });

    it("returns false for an empty list", () => {
      expect(RoleManager.hasAny(member, [])).toBe(false);
    });
  });

  describe("hasAll", () => {
    it("returns true when every role matches", () => {
      expect(RoleManager.hasAll(member, ["role-A", "role-B"])).toBe(true);
    });

    it("returns false when at least one role is missing", () => {
      expect(RoleManager.hasAll(member, ["role-A", "role-Z"])).toBe(false);
    });

    it("returns true for an empty list (vacuous truth)", () => {
      expect(RoleManager.hasAll(member, [])).toBe(true);
    });
  });

  describe("getAll", () => {
    it("returns role IDs excluding @everyone", () => {
      expect(RoleManager.getAll(member).sort()).toEqual(["role-A", "role-B"]);
    });

    it("returns an empty array when only @everyone is present", () => {
      expect(RoleManager.getAll(memberWithRoles([]))).toEqual([]);
    });
  });

  describe("getRoles", () => {
    it("returns Role objects excluding @everyone", () => {
      const roles = RoleManager.getRoles(member);
      expect(roles.map((r) => r.id).sort()).toEqual(["role-A", "role-B"]);
    });

    it("returns an empty array when only @everyone is present", () => {
      expect(RoleManager.getRoles(memberWithRoles([]))).toEqual([]);
    });
  });
});
