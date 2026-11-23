import { describe, it, expect } from "vitest";
import {
  type GuildMember,
  PermissionFlagsBits,
  PermissionsBitField,
  type Role,
} from "discord.js";
import { getUnassignableReason } from "@/discord/utils/roles/self-assignable";

const EVERYONE_ID = "1";
const ROLE_ID = "2";

function makeRole({
  permissions = 0n,
  managed = false,
  channelAllow,
  position = 1,
}: {
  permissions?: bigint;
  managed?: boolean;
  channelAllow?: bigint;
  position?: number;
} = {}) {
  const everyone = {
    id: EVERYONE_ID,
    permissions: new PermissionsBitField(0n),
  };

  const overwrites = new Map(
    channelAllow === undefined
      ? []
      : [[ROLE_ID, { allow: new PermissionsBitField(channelAllow) }]],
  );

  const channel = {
    isThread: () => false,
    permissionOverwrites: { cache: overwrites },
    permissionsFor: () => new PermissionsBitField(0n),
    toString: () => "#testing",
  };

  const role = {
    id: ROLE_ID,
    managed,
    position,
    permissions: new PermissionsBitField(permissions),
    guild: {
      roles: { everyone },
      channels: { cache: new Map([["10", channel]]) },
    },
  };

  return role as unknown as Role;
}

function makeMe(highestPosition = 5) {
  return {
    roles: {
      highest: {
        comparePositionTo: (role: { position: number }) =>
          highestPosition - role.position,
      },
    },
  } as unknown as GuildMember;
}

describe("getUnassignableReason", () => {
  it("allows a plain role below the bot", () => {
    expect(getUnassignableReason(makeRole(), makeMe())).toBeNull();
  });

  it("rejects a role that opens a channel", () => {
    const role = makeRole({ channelAllow: PermissionFlagsBits.ViewChannel });

    expect(getUnassignableReason(role, makeMe())).toMatch(
      /grants extra permissions in #testing/,
    );
  });

  it("lets a role open a channel when channel overwrites are allowed", () => {
    const role = makeRole({ channelAllow: PermissionFlagsBits.ViewChannel });

    expect(
      getUnassignableReason(role, makeMe(), { allowChannelOverwrites: true }),
    ).toBeNull();
  });

  it("still rejects guild-wide permissions when channel overwrites are allowed", () => {
    const role = makeRole({ permissions: PermissionFlagsBits.ManageMessages });

    expect(
      getUnassignableReason(role, makeMe(), { allowChannelOverwrites: true }),
    ).toMatch(/grants permissions beyond @everyone/);
  });

  it("still rejects a managed role when channel overwrites are allowed", () => {
    const role = makeRole({ managed: true });

    expect(
      getUnassignableReason(role, makeMe(), { allowChannelOverwrites: true }),
    ).toBe("is managed by an integration");
  });

  it("still rejects a role at or above the bot when channel overwrites are allowed", () => {
    const role = makeRole({ position: 5 });

    expect(
      getUnassignableReason(role, makeMe(5), { allowChannelOverwrites: true }),
    ).toBe("is at or above my highest role");
  });
});
