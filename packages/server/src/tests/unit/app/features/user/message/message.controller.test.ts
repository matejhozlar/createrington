import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/services", () => ({
  getService: async () => ({ send: sendMock }),
  Services: { MESSAGE_SERVICE: "MESSAGE_SERVICE" },
}));

vi.mock("@/services/discord/message/cache", () => ({
  MESSAGE_CACHE_CONFIG: { servers: [{ serverId: 1, channelId: "chan-1" }] },
}));

import { MessageController } from "@/app/features/user/message/message.controller";
import type { Request, Response } from "express";

function makeReq({
  content,
  withImage = false,
  minecraftUsername = "Steve" as string | null,
}: {
  content?: string;
  withImage?: boolean;
  minecraftUsername?: string | null;
} = {}): Request {
  return {
    body: { serverId: "1", content },
    file: withImage
      ? {
          buffer: Buffer.from("img"),
          mimetype: "image/png",
          size: 3,
          originalname: "photo.png",
        }
      : undefined,
    user: { minecraftUsername },
  } as unknown as Request;
}

function makeRes(): Response {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function sentContent(): string | undefined {
  return sendMock.mock.calls[0][0].content;
}

describe("MessageController.sendMessage", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ success: true, messageId: "m1" });
  });

  it("prefixes text messages with the sender's name", async () => {
    await MessageController.sendMessage(
      makeReq({ content: " hello " }),
      makeRes(),
    );

    expect(sentContent()).toBe("**<Steve>**: hello");
  });

  it("prefixes image-only messages with the sender's name", async () => {
    await MessageController.sendMessage(
      makeReq({ withImage: true }),
      makeRes(),
    );

    expect(sentContent()).toBe("**<Steve>**:");
    expect(sendMock.mock.calls[0][0].files).toHaveLength(1);
  });

  it("falls back to Web User when the account has no Minecraft username", async () => {
    await MessageController.sendMessage(
      makeReq({ withImage: true, minecraftUsername: null }),
      makeRes(),
    );

    expect(sentContent()).toBe("**<Web User>**:");
  });
});
