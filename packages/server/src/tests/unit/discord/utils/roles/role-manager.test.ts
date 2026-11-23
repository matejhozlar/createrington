import { describe, it, expect, beforeEach } from "vitest";
import { Collection } from "discord.js";
import type { GuildMember, Role } from "discord.js";
import { RoleManager } from "@/discord/utils/roles/role-manager";

const role = (id: string, name = `role-${id}`): Role =>
  ({ id, name }) as unknown as Role;

const memberWithRoles = (roleIds: string[]): GuildMember => {
  const cache = new Collection<string, Role>();
  for (const id of roleIds) cache.set(id, role(id));

  return {
    guild: { id: "guild-1" },
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
});
