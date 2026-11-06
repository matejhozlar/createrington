import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ButtonInteraction } from "discord.js";

const find = vi.fn();
const update = vi.fn();
const deletePlayer = vi.fn();

vi.mock("@/db", () => ({
  Q: {
    player: { find: (...args: unknown[]) => find(...args) },
    discord: {
      guild: { member: { leave: { find, update } } },
    },
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

const { execute } =
  await import("@/discord/bots/main/interactions/buttons/member-leave");

const DEPARTED = {
  id: 7,
  minecraftUuid: "11111111-1111-4111-8111-111111111111",
  minecraftUsername: "hypevida",
};

const ADMIN_DISCORD_ID = "424242424242424242";

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

  return { interaction: interaction as unknown as ButtonInteraction, edit };
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

describe("departed:delete-now button", () => {
  beforeEach(() => {
    find.mockReset();
    update.mockReset().mockResolvedValue(undefined);
    deletePlayer.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records the acting admin's minecraft username, not their discord one", async () => {
    find
      .mockResolvedValueOnce(DEPARTED)
      .mockResolvedValueOnce({ minecraftUsername: "saunhardy" });
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
    find.mockResolvedValueOnce(DEPARTED).mockResolvedValueOnce(null);
    const { interaction } = interactionStub();

    await execute(interaction);

    expect(actorOf(deletePlayer.mock.calls[0]).username).toBe("Unknown");
  });

  it("keeps the actor identifiable in the embed when the admin has no player row", async () => {
    find.mockResolvedValueOnce(DEPARTED).mockResolvedValueOnce(null);
    const { interaction, edit } = interactionStub();

    await execute(interaction);

    expect(deletedByField(edit).value).toBe(`<@${ADMIN_DISCORD_ID}>`);
  });
});
