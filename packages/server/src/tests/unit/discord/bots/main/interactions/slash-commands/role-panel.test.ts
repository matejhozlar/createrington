import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";

const replyError = vi.fn();
const getUnassignableReason = vi.fn();

vi.mock("@/discord/utils/interaction-reply", () => ({
  replyError: (...args: unknown[]) => replyError(...args),
}));

vi.mock("@/discord/utils/roles/self-assignable", () => ({
  getUnassignableReason: (...args: unknown[]) => getUnassignableReason(...args),
}));

const { execute } =
  await import("@/discord/bots/main/interactions/slash-commands/owner/role-panel");
const { getRolePanelPreset } =
  await import("@/discord/bots/main/config/role-panel");

const notifications = getRolePanelPreset("notifications")!;

function fakeRole(id: string, name = `role-${id}`) {
  return { id, name, toString: () => `<@&${id}>` };
}

function makeInteraction({
  preset = null,
  roles = [],
  guildRoleIds = notifications.roles.map((r) => r.roleId),
}: {
  preset?: string | null;
  roles?: ReturnType<typeof fakeRole>[];
  guildRoleIds?: string[];
} = {}) {
  const guildRoles = new Map(guildRoleIds.map((id) => [id, fakeRole(id)]));
  const send = vi.fn();
  const reply = vi.fn();

  const interaction = {
    inCachedGuild: () => true,
    channel: { send, messages: { fetch: vi.fn() } },
    user: { tag: "owner" },
    guild: {
      members: {
        fetchMe: vi.fn().mockResolvedValue({
          permissions: { has: () => true },
        }),
      },
      roles: {
        cache: guildRoles,
        fetch: vi.fn().mockResolvedValue(null),
      },
    },
    options: {
      getString: (name: string) => (name === "preset" ? preset : null),
      getRole: (name: string) => {
        const index = Number(name.replace("role", "")) - 1;
        return roles[index] ?? null;
      },
    },
    reply,
  };

  return {
    interaction: interaction as unknown as ChatInputCommandInteraction,
    send,
  };
}

function errorTitle(): unknown {
  return replyError.mock.calls[0]?.[1];
}

describe("/role-panel", () => {
  beforeEach(() => {
    replyError.mockReset();
    getUnassignableReason.mockReset().mockReturnValue(null);
  });

  it("refuses a preset together with roles", async () => {
    const { interaction, send } = makeInteraction({
      preset: "notifications",
      roles: [fakeRole("50")],
    });

    await execute(interaction);

    expect(errorTitle()).toBe("Preset Or Roles");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a panel with neither a preset nor roles", async () => {
    const { interaction, send } = makeInteraction();

    await execute(interaction);

    expect(errorTitle()).toBe("No Roles");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses an unknown preset", async () => {
    const { interaction } = makeInteraction({ preset: "nope" });

    await execute(interaction);

    expect(errorTitle()).toBe("Unknown Preset");
  });

  it("refuses a preset whose role no longer exists", async () => {
    const [first, second] = notifications.roles;
    const { interaction, send } = makeInteraction({
      preset: "notifications",
      guildRoleIds: [first.roleId],
    });

    await execute(interaction);

    expect(errorTitle()).toBe("Roles Not Allowed");
    expect(replyError.mock.calls[0]?.[2]).toContain(
      `${second.label} no longer exists`,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("checks preset roles with channel overwrites allowed and posts the panel", async () => {
    const { interaction, send } = makeInteraction({ preset: "notifications" });

    await execute(interaction);

    expect(replyError).not.toHaveBeenCalled();
    expect(getUnassignableReason).toHaveBeenCalledTimes(
      notifications.roles.length,
    );
    for (const call of getUnassignableReason.mock.calls) {
      expect(call[2]).toEqual({ allowChannelOverwrites: true });
    }
    expect(send).toHaveBeenCalledOnce();
  });

  it("refuses a preset role that fails the remaining checks", async () => {
    getUnassignableReason.mockReturnValue("is at or above my highest role");
    const { interaction, send } = makeInteraction({ preset: "notifications" });

    await execute(interaction);

    expect(errorTitle()).toBe("Roles Not Allowed");
    expect(send).not.toHaveBeenCalled();
  });

  it("checks picked roles with the full check", async () => {
    const { interaction, send } = makeInteraction({ roles: [fakeRole("50")] });

    await execute(interaction);

    expect(getUnassignableReason.mock.calls[0]?.[2]).toEqual({
      allowChannelOverwrites: false,
    });
    expect(send).toHaveBeenCalledOnce();
  });
});
