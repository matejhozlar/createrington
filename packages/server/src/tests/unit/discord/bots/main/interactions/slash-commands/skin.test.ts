import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkRender = vi.hoisted(() => vi.fn(async () => new Uint8Array([1])));

vi.mock("@/db", () => ({
  Q: {
    player: {
      get: async () => ({
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

vi.mock("@/services/skin-api", async () => {
  const quality = await vi.importActual<
    typeof import("@/services/skin-api/quality")
  >("@/services/skin-api/quality");
  return {
    getSkinApiClient: () => ({ render: sdkRender }),
    MAX_QUALITY_RENDER: quality.MAX_QUALITY_RENDER,
  };
});

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

  it("shows the plain skin without rendering when neither is chosen", async () => {
    const { fake, raw } = interactionWith({});

    await execute(fake);

    expect(sdkRender).not.toHaveBeenCalled();
    expect(raw.deferReply).not.toHaveBeenCalled();
    expect(raw.reply).toHaveBeenCalledOnce();
  });

  it("treats an explicit default style exactly like no style", async () => {
    const { fake, raw } = interactionWith({ style: "default" });

    await execute(fake);

    expect(sdkRender).not.toHaveBeenCalled();
    expect(raw.reply).toHaveBeenCalledOnce();
  });

  it("resolves the deferred reply with an error embed when the styled render fails", async () => {
    sdkRender.mockRejectedValue(
      new SkinApiError("Render failed upstream", {
        code: "render_failed",
        status: 500,
      }),
    );
    const { fake, raw, sent } = interactionWith({ pose: "wave", style: "cel" });

    await execute(fake);

    expect(raw.deferReply).toHaveBeenCalledOnce();
    expect(raw.editReply).toHaveBeenCalledOnce();
    expect(sent).toEqual([
      expect.objectContaining({ kind: "error", title: "Render Error" }),
    ]);
    expect(sent[0]?.description).not.toContain("upstream");
  });
});
