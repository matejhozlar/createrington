import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findParty: vi.fn(),
  findParties: vi.fn(),
  countMembers: vi.fn(async () => 3),
  findPlayer: vi.fn(),
  getForMember: vi.fn(),
}));

vi.mock("@/config", () => ({
  default: { servers: { rails: { id: 1 } } },
}));

vi.mock("@/db", () => ({
  Q: {
    player: { find: db.findPlayer },
    server: {
      party: {
        find: db.findParty,
        findAll: db.findParties,
        getForMember: db.getForMember,
        member: { count: db.countMembers },
      },
    },
  },
}));

vi.mock("@/discord/embeds", () => {
  const builder = (kind: string, title?: string, description?: string) => {
    const embed = {
      field: () => embed,
      image: () => embed,
      build: () => ({ kind, title, description }),
    };
    return embed;
  };
  return {
    EmbedPresets: {
      error: (title: string, description?: string) =>
        builder("error", title, description),
      plain: (data: { title?: string; description?: string }) =>
        builder("plain", data.title, data.description),
    },
  };
});

vi.mock("@/discord/embeds/presets/buttons", async () => {
  const { ButtonBuilder, ButtonStyle } = await import("discord.js");
  return {
    ButtonPresets: {
      links: {
        teamTag: () =>
          new ButtonBuilder()
            .setLabel("Open in the editor")
            .setStyle(ButtonStyle.Link)
            .setURL("https://example.com/team-tag"),
      },
    },
  };
});

vi.mock("@/discord/utils/cooldown", () => ({ CooldownType: { USER: "user" } }));

vi.mock("@/discord/utils/render-screenshot", () => ({
  renderScreenshot: async () => null,
}));

import { execute } from "@/discord/bots/main/interactions/slash-commands/user/tag";
import type { ChatInputCommandInteraction } from "discord.js";

interface SentEmbed {
  kind: string;
  title: string;
  description?: string;
}

const TAGGED = {
  id: 7,
  name: "Crafting_Town",
  tagCode: "CRP1:R:CRTN:D9A441:3B230E",
  tag: "CRTN",
  color: 0xd9a441,
};

function interactionWith(subcommand: string, options: Record<string, string>) {
  const sent: SentEmbed[] = [];
  const record = async (message: { embeds: SentEmbed[] }) => {
    sent.push(...message.embeds);
  };
  const fake = {
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => options[name] ?? null,
      getUser: () => null,
    },
    user: { id: "123", displayName: "caller" },
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

describe("/tag team", () => {
  beforeEach(() => {
    db.findParty.mockReset();
    db.findParties.mockReset();
  });

  it("refuses a typed tag that two teams share instead of picking one", async () => {
    db.findParties.mockResolvedValue([TAGGED, { ...TAGGED, id: 8 }]);
    const { fake, raw, sent } = interactionWith("team", { team: "crtn" });

    await execute(fake);

    expect(db.findParties).toHaveBeenCalledWith(
      { serverId: 1, tag: "CRTN" },
      { limit: 2 },
    );
    expect(raw.deferReply).not.toHaveBeenCalled();
    expect(sent).toEqual([
      expect.objectContaining({ kind: "error", title: "Ambiguous Tag" }),
    ]);
  });

  it("renders the only team that uses a typed tag", async () => {
    db.findParties.mockResolvedValue([TAGGED]);
    const { fake, sent } = interactionWith("team", { team: "crtn" });

    await execute(fake);

    expect(sent).toEqual([
      expect.objectContaining({ kind: "plain", title: "Crafting_Town" }),
    ]);
  });

  it("looks a suggested team up by its id", async () => {
    db.findParty.mockResolvedValue(TAGGED);
    const teamId = "aaaaaaaa-0000-4000-8000-000000000001";
    const { fake } = interactionWith("team", { team: teamId });

    await execute(fake);

    expect(db.findParty).toHaveBeenCalledWith({ serverId: 1, teamId });
    expect(db.findParties).not.toHaveBeenCalled();
  });

  it("escapes markdown in the typed value of an unknown team", async () => {
    db.findParties.mockResolvedValue([]);
    const { fake, sent } = interactionWith("team", { team: "foo`bar*" });

    await execute(fake);

    expect(sent[0]!.description).toBe(
      "No team matches **foo\\`bar\\***. Pick one from the suggestions.",
    );
  });

  it("escapes markdown in the team name of an untagged team", async () => {
    db.findParties.mockResolvedValue([{ ...TAGGED, tagCode: null }]);
    const { fake, sent } = interactionWith("team", { team: "crtn" });

    await execute(fake);

    expect(sent[0]!.description).toBe(
      "**Crafting\\_Town** has no team tag yet.",
    );
  });
});
