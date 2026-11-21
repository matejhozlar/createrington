import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkRender = vi.hoisted(() => vi.fn(async () => new Uint8Array([1])));

vi.mock("@/db", () => ({
  Q: {
    player: {
      find: async () => ({
        minecraftUuid: "uuid-1",
        minecraftUsername: "Steve",
      }),
    },
  },
}));

vi.mock("@/discord/embeds", () => {
  const preset = (kind: string) => (title: string, description?: string) => {
    const builder = {
      image: () => builder,
      build: () => ({ kind, title, description }),
    };
    return builder;
  };
  return { EmbedPresets: { info: preset("info"), error: preset("error") } };
});

vi.mock("@/discord/utils/cooldown", () => ({ CooldownType: { USER: "user" } }));

vi.mock("@/services/skin-api/client", () => ({
  getSkinApiClient: () => ({ render: sdkRender }),
}));

import {
  data,
  execute,
} from "@/discord/bots/main/interactions/slash-commands/user/skin";
import { MAX_QUALITY_RENDER } from "@/services/skin-api/quality";
import { SkinApiError } from "createrington-skin-api";
import type { ChatInputCommandInteraction } from "discord.js";

interface SentEmbed {
  kind: string;
  title: string;
  description?: string;
}

function interactionWith(options: { pose?: string; style?: string }) {
  const sent: SentEmbed[] = [];
  const record = async (message: { embeds: SentEmbed[] }) => {
    sent.push(...message.embeds);
  };
  const fake = {
    options: {
      getUser: () => null,
      getString: (name: "pose" | "style") => options[name] ?? null,
    },
    user: { id: "123", displayName: "steve" },
    deferred: false,
    replied: false,
    reply: vi.fn(record),
    editReply: vi.fn(record),
    followUp: vi.fn(record),
    deferReply: vi.fn(async () => {
      fake.deferred = true;
    }),
  };
  return {
    fake: fake as unknown as ChatInputCommandInteraction,
    raw: fake,
    sent,
  };
}

describe("/skin style option", () => {
  beforeEach(() => {
    sdkRender.mockReset();
    sdkRender.mockResolvedValue(new Uint8Array([1]));
  });

  it("offers default and cel as the style choices", () => {
    const style = data.toJSON().options?.find((opt) => opt.name === "style");

    expect(style).toMatchObject({
      required: false,
      choices: [
        { name: "Default", value: "default" },
        { name: "Cel", value: "cel" },
      ],
    });
  });

  it("renders the default style when no style is chosen", async () => {
    const { fake, sent } = interactionWith({ pose: "wave" });

    await execute(fake);

    expect(sdkRender).toHaveBeenCalledWith({
      pose: "wave",
      source: { uuid: "uuid-1" },
      options: { ...MAX_QUALITY_RENDER, style: "default" },
    });
    expect(sent).toEqual([expect.objectContaining({ title: "Steve — Wave" })]);
  });

  it("renders the cel style at full quality", async () => {
    const { fake, sent } = interactionWith({ pose: "wave", style: "cel" });

    await execute(fake);

    expect(sdkRender).toHaveBeenCalledWith({
      pose: "wave",
      source: { uuid: "uuid-1" },
      options: { ...MAX_QUALITY_RENDER, style: "cel" },
    });
    expect(sent).toEqual([
      expect.objectContaining({ title: "Steve — Wave (Cel)" }),
    ]);
  });

  it("falls back to the idle pose when only a style is chosen", async () => {
    const { fake } = interactionWith({ style: "cel" });

    await execute(fake);

    expect(sdkRender).toHaveBeenCalledWith(
      expect.objectContaining({
        pose: "idle",
        options: expect.objectContaining({ style: "cel" }),
      }),
    );
  });

  it("renders the idle pose in the default style when neither is chosen", async () => {
    const { fake, raw, sent } = interactionWith({});

    await execute(fake);

    expect(sdkRender).toHaveBeenCalledWith({
      pose: "idle",
      source: { uuid: "uuid-1" },
      options: { ...MAX_QUALITY_RENDER, style: "default" },
    });
    expect(raw.deferReply).toHaveBeenCalledOnce();
    expect(sent).toEqual([expect.objectContaining({ title: "Steve — Idle" })]);
  });

  it("treats an explicit default style exactly like no style", async () => {
    const { fake } = interactionWith({ style: "default" });

    await execute(fake);

    expect(sdkRender).toHaveBeenCalledWith(
      expect.objectContaining({
        pose: "idle",
        options: expect.objectContaining({ style: "default" }),
      }),
    );
  });

  it("fails with a render error naming the pose when the styled render fails", async () => {
    sdkRender.mockRejectedValue(
      new SkinApiError("Render failed upstream", {
        code: "render_failed",
        status: 500,
      }),
    );
    const { fake, raw, sent } = interactionWith({ pose: "wave", style: "cel" });

    await expect(execute(fake)).rejects.toMatchObject({
      title: "Render Error",
      description:
        "Could not render the **Wave** pose for Steve. Please try again later.",
      cause: expect.any(SkinApiError),
    });

    expect(raw.deferReply).toHaveBeenCalledOnce();
    expect(sent).toEqual([]);
  });
});
