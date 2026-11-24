import { describe, it, expect, vi, beforeEach } from "vitest";

const getExpired = vi.fn();
const leaveUpdate = vi.fn();
const playerFind = vi.fn();
const deletePlayer = vi.fn();
const lookupMember = vi.fn();
const messages = vi.hoisted(() => ({ edit: vi.fn() }));

vi.mock("@/db", () => ({
  Q: {
    player: { find: (...args: unknown[]) => playerFind(...args) },
    discord: {
      guild: { member: { leave: { getExpired, update: leaveUpdate } } },
    },
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "900" } },
    Messages: messages,
  },
}));

vi.mock("@/services/player/deletion", () => ({
  playerDeletionService: {
    delete: (...args: unknown[]) => deletePlayer(...args),
  },
}));

vi.mock("@/services/waitlist/discord-lookup", () => ({
  lookupMember: (...args: unknown[]) => lookupMember(...args),
}));

const { MemberCleanupService } =
  await import("@/services/discord/cleanup/member/member-cleanup.service");

const DEPARTED_DISCORD_ID = "111111111111111111";

const EXPIRED = {
  id: 3,
  discordId: DEPARTED_DISCORD_ID,
  minecraftUuid: "11111111-1111-4111-8111-111111111111",
  minecraftUsername: "hypevida",
  departedAt: new Date("2026-09-01T00:00:00Z"),
  notificationMessageId: "555",
};

function editedTitle() {
  return messages.edit.mock.calls[0][0].embeds.data.title as string;
}

describe("MemberCleanupService sweep", () => {
  beforeEach(() => {
    getExpired.mockReset().mockResolvedValue([EXPIRED]);
    leaveUpdate.mockReset().mockResolvedValue(undefined);
    playerFind.mockReset().mockResolvedValue({
      discordId: DEPARTED_DISCORD_ID,
      minecraftUuid: EXPIRED.minecraftUuid,
    });
    deletePlayer.mockReset().mockResolvedValue(null);
    lookupMember.mockReset().mockResolvedValue({ state: "gone" });
    messages.edit.mockReset().mockResolvedValue(undefined);
  });

  it("deletes a player whose member is still gone", async () => {
    await new MemberCleanupService().triggerManualCleanup();

    expect(deletePlayer).toHaveBeenCalledWith(
      { minecraftUuid: EXPIRED.minecraftUuid },
      expect.objectContaining({ ignoreMissing: true }),
    );
    expect(editedTitle()).toBe("Member Auto-Deleted");
  });

  it("cancels the row when the member rejoined while the bot was down", async () => {
    lookupMember.mockResolvedValue({ state: "found", member: {} });

    await new MemberCleanupService().triggerManualCleanup();

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(leaveUpdate).toHaveBeenCalledWith(
      { id: EXPIRED.id },
      { deletedAt: expect.any(Date) },
    );
    expect(editedTitle()).toBe("Member Returned");
  });

  it("cancels the row when the minecraft account moved to another discord account", async () => {
    playerFind.mockResolvedValue({
      discordId: "999999999999999999",
      minecraftUuid: EXPIRED.minecraftUuid,
    });

    await new MemberCleanupService().triggerManualCleanup();

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(editedTitle()).toBe("Departure Cancelled");
  });

  it("keeps the row for the next pass when discord cannot be reached", async () => {
    lookupMember.mockResolvedValue({ state: "unavailable" });

    await new MemberCleanupService().triggerManualCleanup();

    expect(deletePlayer).not.toHaveBeenCalled();
    expect(leaveUpdate).not.toHaveBeenCalled();
  });
});
