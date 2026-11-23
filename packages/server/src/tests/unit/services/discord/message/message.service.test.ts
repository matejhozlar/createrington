import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Client, DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

vi.mock("@/config", () => ({
  default: { discord: { guild: { id: "guild-1" } } },
}));

import { DiscordMessageService } from "@/services/discord/message/message.service";
import { ChannelUnavailableError } from "@/services/discord/message/errors";

function discordError(code: number, message: string): DiscordAPIError {
  return new DiscordAPIError(
    { code, message },
    code,
    404,
    "GET",
    "/channels",
    {},
  );
}

const channelFetch = vi.fn();
const messageFetch = vi.fn();
const channelSend = vi.fn();

function service(): DiscordMessageService {
  const client = {
    guilds: {
      fetch: async () => ({ channels: { fetch: channelFetch } }),
    },
  } as unknown as Client;
  return new DiscordMessageService(client);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "info").mockImplementation(() => logger);
  channelFetch.mockResolvedValue({
    send: channelSend,
    messages: { fetch: messageFetch },
  });
});

describe("DiscordMessageService", () => {
  it("returns the posted message", async () => {
    channelSend.mockResolvedValue({ id: "message-1" });

    await expect(
      service().send({ channelId: "channel-1", content: "hi" }),
    ).resolves.toEqual({ id: "message-1" });
    expect(channelSend).toHaveBeenCalledWith(
      expect.objectContaining({ allowedMentions: { parse: [] } }),
    );
  });

  it("throws ChannelUnavailableError for a channel Discord does not know", async () => {
    const unknown = discordError(
      RESTJSONErrorCodes.UnknownChannel,
      "Unknown Channel",
    );
    channelFetch.mockRejectedValue(unknown);

    await expect(
      service().send({ channelId: "channel-1", content: "hi" }),
    ).rejects.toMatchObject({
      name: "ChannelUnavailableError",
      channelId: "channel-1",
      cause: unknown,
    });
  });

  it("throws ChannelUnavailableError for a channel the bot cannot post in", async () => {
    channelFetch.mockResolvedValue({ type: "category" });

    await expect(
      service().send({ channelId: "channel-1", content: "hi" }),
    ).rejects.toBeInstanceOf(ChannelUnavailableError);
  });

  it("throws MessageGoneError when the message to edit was deleted", async () => {
    messageFetch.mockRejectedValue(
      discordError(RESTJSONErrorCodes.UnknownMessage, "Unknown Message"),
    );

    await expect(
      service().edit({
        channelId: "channel-1",
        messageId: "message-1",
        content: "x",
      }),
    ).rejects.toMatchObject({
      name: "MessageGoneError",
      channelId: "channel-1",
      messageId: "message-1",
    });
  });

  it("lets any other Discord error through unchanged", async () => {
    const forbidden = discordError(
      RESTJSONErrorCodes.MissingPermissions,
      "Missing Permissions",
    );
    messageFetch.mockResolvedValue({
      delete: vi.fn().mockRejectedValue(forbidden),
    });

    const failure = await service()
      .delete({ channelId: "channel-1", messageId: "message-1" })
      .catch((error: unknown) => error);

    expect(failure).toBe(forbidden);
  });
});
