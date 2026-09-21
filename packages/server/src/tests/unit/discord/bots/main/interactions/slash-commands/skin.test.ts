import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkRender = vi.hoisted(() => vi.fn(async () => new Uint8Array([1])));
const renderStyledSkin = vi.hoisted(() => vi.fn(async () => Buffer.from([2])));
const embedTitles = vi.hoisted(() => [] as string[]);

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

vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    info: (title: string) => {
      embedTitles.push(title);
      const builder = { image: () => builder, build: () => ({ title }) };
      return builder;
    },
  },
}));

vi.mock("@/discord/utils/interaction-reply", () => ({ replyError: vi.fn() }));
vi.mock("@/discord/utils/cooldown", () => ({ CooldownType: { USER: "user" } }));

vi.mock("@/services/skin-api", () => ({
  getSkinApiClient: () => ({ render: sdkRender }),
  renderStyledSkin,
  MAX_QUALITY_RENDER: { width: 1366, height: 2048 },
  SKIN_RENDER_STYLES: ["default", "cel"],
}));

import {
  data,
  execute,
} from "@/discord/bots/main/interactions/slash-commands/user/skin";
import type { ChatInputCommandInteraction } from "discord.js";

function interactionWith(options: { pose?: string; style?: string }) {
  const reply = vi.fn(async () => {});
  const editReply = vi.fn(async () => {});
  const fake = {
    options: {
      getUser: () => null,
      getString: (name: "pose" | "style") => options[name] ?? null,
    },
    user: { id: "123", displayName: "steve" },
    reply,
    deferReply: vi.fn(async () => {}),
    editReply,
  };
  return {
    fake: fake as unknown as ChatInputCommandInteraction,
    reply,
    editReply,
  };
}

describe("/skin style option", () => {
  beforeEach(() => {
    sdkRender.mockClear();
    renderStyledSkin.mockClear();
    embedTitles.length = 0;
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

  it("keeps rendering through the SDK when no style is chosen", async () => {
    const { fake, editReply } = interactionWith({ pose: "wave" });

    await execute(fake);

    expect(sdkRender).toHaveBeenCalledWith({
      pose: "wave",
      source: { uuid: "uuid-1" },
      options: { width: 1366, height: 2048 },
    });
    expect(renderStyledSkin).not.toHaveBeenCalled();
    expect(embedTitles).toEqual(["Steve — Wave"]);
    expect(editReply).toHaveBeenCalledOnce();
  });

  it("renders the cel style through the styled helper", async () => {
    const { fake } = interactionWith({ pose: "wave", style: "cel" });

    await execute(fake);

    expect(renderStyledSkin).toHaveBeenCalledWith({
      uuid: "uuid-1",
      pose: "wave",
      style: "cel",
    });
    expect(sdkRender).not.toHaveBeenCalled();
    expect(embedTitles).toEqual(["Steve — Wave (Cel)"]);
  });

  it("falls back to the idle pose when only a style is chosen", async () => {
    const { fake } = interactionWith({ style: "cel" });

    await execute(fake);

    expect(renderStyledSkin).toHaveBeenCalledWith({
      uuid: "uuid-1",
      pose: "idle",
      style: "cel",
    });
  });

  it("shows the plain skin without rendering when neither is chosen", async () => {
    const { fake, reply } = interactionWith({});

    await execute(fake);

    expect(sdkRender).not.toHaveBeenCalled();
    expect(renderStyledSkin).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });

  it("treats an explicit default style exactly like no style", async () => {
    const { fake, reply } = interactionWith({ style: "default" });

    await execute(fake);

    expect(renderStyledSkin).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });
});
