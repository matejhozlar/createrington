import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MessageFlags, type ButtonInteraction } from "discord.js";
import { execute } from "@/discord/bots/main/interactions/buttons/registration";
import { CLOSE_GRACE_MS } from "@/discord/bots/main/registration-cleanup";
import { REGISTER_CLOSE_BUTTON_ID } from "@/discord/components/presets/registration";
import { Discord } from "@/discord/constants";

// The handler only reads a handful of fields off the interaction, so a plain
// object is enough. The cast goes via `unknown` because ButtonInteraction has
// type-predicate methods an object literal can't satisfy structurally.
function interactionStub(overrides: { parentId?: string | null } = {}) {
  const update = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);
  const deferUpdate = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);

  const channel = {
    name: "verify-1",
    parentId:
      overrides.parentId === undefined
        ? Discord.Categories.VERIFICATION
        : overrides.parentId,
    send: () => {},
    isDMBased: () => false,
    delete: del,
  };

  const interaction = {
    customId: REGISTER_CLOSE_BUTTON_ID,
    user: { tag: "steve", id: "1" },
    channel,
    update,
    reply,
    deferUpdate,
  };

  return {
    interaction: interaction as unknown as ButtonInteraction,
    update,
    reply,
    deferUpdate,
    del,
  };
}

describe("registration close button", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("updates the card as Components V2 and clears the legacy fields", async () => {
    const { interaction, update } = interactionStub();

    await execute(interaction);

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0];
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(payload.components.length).toBeGreaterThan(0);
    // Discord rejects an edit that sets IS_COMPONENTS_V2 while content or
    // embeds are non-empty, and a pre-migration card still carries an embed.
    expect(payload.content).toBeNull();
    expect(payload.embeds).toEqual([]);
  });

  it("deletes the channel after the grace period", async () => {
    const { interaction, del } = interactionStub();

    await execute(interaction);
    expect(del).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("acknowledges the click and still deletes when the card fails to render", async () => {
    const { interaction, update, deferUpdate, del } = interactionStub();
    update.mockRejectedValueOnce(new Error("50035"));

    await execute(interaction);

    expect(deferUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("refuses to close a channel outside the verification category", async () => {
    const { interaction, update, reply, del } = interactionStub({
      parentId: "some-other-category",
    });

    await execute(interaction);

    expect(update).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);
    expect(del).not.toHaveBeenCalled();
  });
});
