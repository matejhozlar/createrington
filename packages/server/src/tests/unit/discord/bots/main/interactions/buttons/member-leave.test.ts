import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ButtonInteraction } from "discord.js";

const leaveFind = vi.fn();
const leaveUpdate = vi.fn();
const playerFind = vi.fn();
const deletePlayer = vi.fn();
const lookupMember = vi.fn();
const messages = vi.hoisted(() => ({ edit: vi.fn() }));

vi.mock("@/db", () => ({
  Q: {
    player: { find: (...args: unknown[]) => playerFind(...args) },
    discord: {
      guild: { member: { leave: { find: leaveFind, update: leaveUpdate } } },
    },
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "900" } },
    Messages: messages,
  },
}));

vi.mock("@/discord/utils/admin-guard", () => ({
  isAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/player/deletion", () => ({
  playerDeletionService: {
    delete: (...args: unknown[]) => deletePlayer(...args),
  },
}));

vi.mock("@/services/waitlist/discord-lookup", () => ({
  lookupMember: (...args: unknown[]) => lookupMember(...args),
}));

const { execute } = (
  await import("@/discord/bots/main/interactions/buttons/member-leave")
).default;

const DEPARTED_DISCORD_ID = "111111111111111111";
const ADMIN_DISCORD_ID = "424242424242424242";

const DEPARTED = {
  id: 7,
  discordId: DEPARTED_DISCORD_ID,
  minecraftUuid: "11111111-1111-4111-8111-111111111111",
  minecraftUsername: "hypevida",
  departedAt: new Date("2026-10-01T00:00:00Z"),
  notificationMessageId: "555",
  deletedAt: null as Date | null,
};

function givenPlayers(options: {
  departedOwner?: string | null;
  admin?: { minecraftUsername: string } | null;
}) {
  playerFind.mockImplementation(
    async (filter: { minecraftUuid?: string; discordId?: string }) => {
      if (filter.minecraftUuid === DEPARTED.minecraftUuid) {
        const owner = options.departedOwner ?? DEPARTED_DISCORD_ID;
        return { discordId: owner, minecraftUuid: DEPARTED.minecraftUuid };
      }
      if (filter.discordId === ADMIN_DISCORD_ID) return options.admin ?? null;
      return null;
    },
  );
}

// Only the fields handleDeleteNow touches. The cast goes via `unknown`
// because ButtonInteraction carries type-predicate methods an object
// literal cannot satisfy structurally.
function interactionStub() {
  const edit = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);
  const deferUpdate = vi.fn().mockResolvedValue(undefined);

  const interaction = {
    customId: "departed:delete-now:7",
    user: { id: ADMIN_DISCORD_ID, tag: "matejhoz", username: "matejhoz" },
    message: { edit },
    followUp,
    deferUpdate,
  };

  return {
    interaction: interaction as unknown as ButtonInteraction,
    edit,
    followUp,
  };
}

function actorOf(call: unknown[]) {
  return (call[1] as { actor: { username: string } }).actor;
}

function deletedByField(edit: ReturnType<typeof vi.fn>) {
  const embed = edit.mock.calls[0][0].embeds[0];
  return embed.data.fields.find(
    (f: { name: string }) => f.name === "Deleted By",
  ) as { value: string };
}

function followUpTitle(followUp: ReturnType<typeof vi.fn>) {
  return followUp.mock.calls[0][0].embeds[0].data.title as string;
}

describe("departed:delete-now button", () => {
  beforeEach(() => {
    leaveFind.mockReset().mockResolvedValue(DEPARTED);
    leaveUpdate.mockReset().mockResolvedValue(undefined);
    playerFind.mockReset();
    deletePlayer.mockReset().mockResolvedValue(null);
    lookupMember.mockReset().mockResolvedValue({ state: "gone" });
    messages.edit.mockReset().mockResolvedValue(undefined);
    givenPlayers({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records the acting admin's minecraft username, not their discord one", async () => {
    givenPlayers({ admin: { minecraftUsername: "saunhardy" } });
    const { interaction, edit } = interactionStub();

    await execute(interaction);

    expect(actorOf(deletePlayer.mock.calls[0])).toMatchObject({
      discordId: ADMIN_DISCORD_ID,
      username: "saunhardy",
    });
    expect(deletedByField(edit).value).toBe(
      `<@${ADMIN_DISCORD_ID}> (\`saunhardy\`)`,
    );
  });

  it("falls back to Unknown in the audit row when the admin has no player row", async () => {
    const { interaction } = interactionStub();

    await execute(interaction);

    expect(actorOf(deletePlayer.mock.calls[0]).username).toBe("Unknown");
  });

  it("keeps the actor identifiable in the embed when the admin has no player row", async () => {
    const { interaction, edit } = interactionStub();

    await execute(interaction);

    expect(deletedByField(edit).value).toBe(`<@${ADMIN_DISCORD_ID}>`);
  });

  it("refuses a row that is already resolved and answers with a follow-up", async () => {
    leaveFind.mockResolvedValue({ ...DEPARTED, deletedAt: new Date() });
    const { interaction, edit, followUp } = interactionStub();

    await execute(interaction);

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    expect(followUpTitle(followUp)).toBe("❌ Not Found");
  });

  it("cancels the row instead of deleting when the member is back in the guild", async () => {
    lookupMember.mockResolvedValue({ state: "found", member: {} });
    const { interaction, followUp } = interactionStub();

    await execute(interaction);

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(leaveUpdate).toHaveBeenCalledWith(
      { id: DEPARTED.id },
      { deletedAt: expect.any(Date) },
    );
    expect(messages.edit.mock.calls[0][0].embeds.data.title).toBe(
      "Member Returned",
    );
    expect(followUpTitle(followUp)).toBe("ℹ️ Departure Cancelled");
  });

  it("cancels the row when the player now belongs to another discord account", async () => {
    givenPlayers({ departedOwner: "999999999999999999" });
    const { interaction } = interactionStub();

    await execute(interaction);

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(lookupMember).not.toHaveBeenCalled();
    expect(messages.edit.mock.calls[0][0].embeds.data.title).toBe(
      "Departure Cancelled",
    );
  });

  it("leaves the row active when discord cannot be reached", async () => {
    lookupMember.mockResolvedValue({ state: "unavailable" });
    const { interaction, followUp } = interactionStub();

    await execute(interaction);

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(leaveUpdate).not.toHaveBeenCalled();
    expect(followUpTitle(followUp)).toBe("❌ Discord Unavailable");
  });
});
