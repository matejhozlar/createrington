import { describe, it, expect } from "vitest";
import { type Channel, ChannelType } from "discord.js";
import {
  isGuildTextChannel,
  isSendableChannel,
} from "@/discord/utils/channel-guard";

const stubChannel = (overrides: Record<string, unknown>): Channel =>
  overrides as unknown as Channel;

describe("isSendableChannel", () => {
  it("returns false for null", () => {
    expect(isSendableChannel(null)).toBe(false);
  });

  it("returns true when channel has a send function", () => {
    expect(isSendableChannel(stubChannel({ send: () => {} }))).toBe(true);
  });

  it("returns false when send is not a function", () => {
    expect(isSendableChannel(stubChannel({ send: "not-a-fn" }))).toBe(false);
  });

  it("returns false when send is missing", () => {
    expect(isSendableChannel(stubChannel({}))).toBe(false);
  });
});

describe("isGuildTextChannel", () => {
  it("accepts guild text and announcement channels", () => {
    expect(
      isGuildTextChannel(stubChannel({ type: ChannelType.GuildText })),
    ).toBe(true);
    expect(
      isGuildTextChannel(stubChannel({ type: ChannelType.GuildAnnouncement })),
    ).toBe(true);
  });

  it("rejects threads, DMs and null", () => {
    expect(
      isGuildTextChannel(stubChannel({ type: ChannelType.PublicThread })),
    ).toBe(false);
    expect(isGuildTextChannel(stubChannel({ type: ChannelType.DM }))).toBe(
      false,
    );
    expect(isGuildTextChannel(null)).toBe(false);
  });
});
