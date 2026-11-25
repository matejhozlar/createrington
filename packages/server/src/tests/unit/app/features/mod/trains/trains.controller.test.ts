import { describe, it, expect, vi, beforeEach } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/db", () => ({
  Q: { player: { findAll: async () => [] } },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Messages: { send },
    Channels: { railsNSails: { NOTIFICATIONS: "notifications-1" } },
    Roles: { RAILSNSAILSNOTIFICATIONS: "role-crash" },
  },
}));

vi.mock("@/discord/embeds", () => {
  const embed = {
    title: () => embed,
    color: () => embed,
    field: () => embed,
    footer: () => embed,
    timestamp: () => embed,
    build: () => ({}),
  };
  return { createEmbed: () => embed };
});

vi.mock("@/discord/embeds/colors", () => ({
  EmbedColors: { Warning: 0 },
}));

import { TrainsController } from "@/app/features/mod/trains/trains.controller";
import { fakeReq, fakeRes } from "@/tests/helpers/http";

describe("TrainsController.reportCrash", () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ id: "message-1" });
  });

  it("pings the train-crash role it mentions", async () => {
    const res = fakeRes({
      validated: {
        params: {},
        query: {},
        body: { trainId: "train-1", trainName: "Express" },
      },
    });

    await TrainsController.reportCrash(fakeReq(), res);

    expect(send).toHaveBeenCalledOnce();
    const [message] = send.mock.calls[0];
    expect(message.content).toContain("<@&role-crash>");
    expect(message.allowedMentions).toEqual({ roles: ["role-crash"] });
  });
});
