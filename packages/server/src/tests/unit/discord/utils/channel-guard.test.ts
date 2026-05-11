import { describe, it, expect } from "vitest";
import type { Channel } from "discord.js";
import {
  isSendableChannel,
  isTextChannel,
  isVoiceChannel,
  isThreadChannel,
  isDMChannel,
} from "@/discord/utils/channel-guard";

// Minimal Channel-shaped stubs. The guards check for specific structure
// (a `send` function, a numeric `type`, or `isThread()`/`isDMBased()` methods),
// so we don't need a real discord.js Channel instance. The cast goes via
// `unknown` because the discord.js Channel union has type-predicate methods
// (`isThread(): this is AnyThreadChannel`) that a plain object literal can't
// satisfy structurally, but the guards only care about the runtime shape.
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

describe("isTextChannel", () => {
  it("returns false for null", () => {
    expect(isTextChannel(null)).toBe(false);
  });

  it("returns true when channel.type === 0", () => {
    expect(isTextChannel(stubChannel({ type: 0 }))).toBe(true);
  });

  it("returns false for non-text channel types", () => {
    expect(isTextChannel(stubChannel({ type: 2 }))).toBe(false);
    expect(isTextChannel(stubChannel({ type: 11 }))).toBe(false);
  });
});

describe("isVoiceChannel", () => {
  it("returns false for null", () => {
    expect(isVoiceChannel(null)).toBe(false);
  });

  it("returns true when channel.type === 2", () => {
    expect(isVoiceChannel(stubChannel({ type: 2 }))).toBe(true);
  });

  it("returns false for non-voice channel types", () => {
    expect(isVoiceChannel(stubChannel({ type: 0 }))).toBe(false);
  });
});

describe("isThreadChannel", () => {
  it("returns false for null", () => {
    expect(isThreadChannel(null)).toBe(false);
  });

  it("returns true when isThread() returns true", () => {
    expect(isThreadChannel(stubChannel({ isThread: () => true }))).toBe(true);
  });

  it("returns false when isThread() returns false", () => {
    expect(isThreadChannel(stubChannel({ isThread: () => false }))).toBe(false);
  });
});

describe("isDMChannel", () => {
  it("returns false for null", () => {
    expect(isDMChannel(null)).toBe(false);
  });

  it("returns true when isDMBased() returns true", () => {
    expect(isDMChannel(stubChannel({ isDMBased: () => true }))).toBe(true);
  });

  it("returns false when isDMBased() returns false", () => {
    expect(isDMChannel(stubChannel({ isDMBased: () => false }))).toBe(false);
  });
});
