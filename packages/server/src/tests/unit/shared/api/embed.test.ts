import { describe, it, expect } from "vitest";
import {
  embedBotSchema,
  embedFieldSchema,
  embedLinkButtonSchema,
  embedActionButtonSchema,
  embedDataSchema,
} from "@createrington/shared/api/embed";

describe("embedBotSchema", () => {
  it("accepts the documented bot identifiers", () => {
    expect(embedBotSchema.parse("main")).toBe("main");
    expect(embedBotSchema.parse("web")).toBe("web");
  });

  it("rejects unknown bot identifiers", () => {
    expect(() => embedBotSchema.parse("other")).toThrow();
  });
});

describe("embedFieldSchema", () => {
  it("accepts a minimal valid field and applies the inline default", () => {
    expect(embedFieldSchema.parse({ name: "n", value: "v" })).toEqual({
      name: "n",
      value: "v",
      inline: false,
    });
  });

  it("preserves an explicit inline value", () => {
    expect(
      embedFieldSchema.parse({ name: "n", value: "v", inline: true }),
    ).toEqual({ name: "n", value: "v", inline: true });
  });

  it("rejects empty name or value", () => {
    expect(() => embedFieldSchema.parse({ name: "", value: "v" })).toThrow();
    expect(() => embedFieldSchema.parse({ name: "n", value: "" })).toThrow();
  });

  it("enforces Discord's name length cap (256)", () => {
    expect(() =>
      embedFieldSchema.parse({ name: "x".repeat(257), value: "v" }),
    ).toThrow();
  });

  it("enforces Discord's value length cap (1024)", () => {
    expect(() =>
      embedFieldSchema.parse({ name: "n", value: "x".repeat(1025) }),
    ).toThrow();
  });
});

describe("embedLinkButtonSchema", () => {
  it("accepts a valid link button", () => {
    expect(
      embedLinkButtonSchema.parse({
        label: "Visit",
        url: "https://example.com",
      }),
    ).toMatchObject({ label: "Visit", url: "https://example.com" });
  });

  it("accepts an optional emoji", () => {
    const parsed = embedLinkButtonSchema.parse({
      label: "Visit",
      url: "https://example.com",
      emoji: "🔥",
    });
    expect(parsed.emoji).toBe("🔥");
  });

  it("rejects malformed URLs", () => {
    expect(() =>
      embedLinkButtonSchema.parse({ label: "Visit", url: "not-a-url" }),
    ).toThrow();
  });

  it("enforces the label length cap (80)", () => {
    expect(() =>
      embedLinkButtonSchema.parse({
        label: "x".repeat(81),
        url: "https://example.com",
      }),
    ).toThrow();
  });
});

describe("embedActionButtonSchema", () => {
  const valid = {
    label: "Open ticket",
    action: "create_thread" as const,
    channelId: "123",
    threadName: "Support",
    threadMessage: "Hi, how can we help?",
  };

  it("accepts a valid create_thread button", () => {
    expect(embedActionButtonSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects actions other than create_thread", () => {
    expect(() =>
      embedActionButtonSchema.parse({ ...valid, action: "delete_thread" }),
    ).toThrow();
  });

  it("requires a non-empty channelId", () => {
    expect(() =>
      embedActionButtonSchema.parse({ ...valid, channelId: "" }),
    ).toThrow();
  });

  it("enforces threadName max length (100)", () => {
    expect(() =>
      embedActionButtonSchema.parse({
        ...valid,
        threadName: "x".repeat(101),
      }),
    ).toThrow();
  });

  it("enforces threadMessage max length (2000)", () => {
    expect(() =>
      embedActionButtonSchema.parse({
        ...valid,
        threadMessage: "x".repeat(2001),
      }),
    ).toThrow();
  });
});

describe("embedDataSchema", () => {
  it("accepts an empty object and applies all documented defaults", () => {
    expect(embedDataSchema.parse({})).toEqual({
      fields: [],
      timestamp: false,
      buttons: [],
      actionButtons: [],
    });
  });

  it("accepts every optional field", () => {
    const parsed = embedDataSchema.parse({
      title: "T",
      description: "D",
      color: 0xff0000,
      url: "https://example.com",
      footer: "F",
      author: "A",
      authorUrl: "https://example.com/u",
      authorIconUrl: "https://example.com/icon.png",
      thumbnailUrl: "https://example.com/t.png",
      imageUrl: "https://example.com/i.png",
      timestamp: true,
    });
    expect(parsed.title).toBe("T");
    expect(parsed.color).toBe(0xff0000);
  });

  it("allows empty strings for optional URL fields", () => {
    const parsed = embedDataSchema.parse({
      url: "",
      authorUrl: "",
      authorIconUrl: "",
      thumbnailUrl: "",
      imageUrl: "",
    });
    expect(parsed.url).toBe("");
  });

  it("rejects color values outside [0, 0xffffff]", () => {
    expect(() => embedDataSchema.parse({ color: -1 })).toThrow();
    expect(() => embedDataSchema.parse({ color: 0xffffff + 1 })).toThrow();
  });

  it("enforces a max of 25 fields", () => {
    const fields = Array.from({ length: 26 }, () => ({
      name: "n",
      value: "v",
    }));
    expect(() => embedDataSchema.parse({ fields })).toThrow();
  });

  it("enforces a max of 5 link buttons", () => {
    const buttons = Array.from({ length: 6 }, () => ({
      label: "Visit",
      url: "https://example.com",
    }));
    expect(() => embedDataSchema.parse({ buttons })).toThrow();
  });

  it("rejects descriptions longer than 4096 characters", () => {
    expect(() =>
      embedDataSchema.parse({ description: "x".repeat(4097) }),
    ).toThrow();
  });
});
