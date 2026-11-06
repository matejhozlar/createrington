import { describe, it, expect } from "vitest";
import { ComponentType, MessageFlags } from "discord.js";
import { PlayerPromptComponentPresets } from "@/discord/components/presets/player-prompt";
import type { PlayerPrompt } from "@createrington/shared/db/player_prompt.types";

const endsAt = new Date("2030-01-01T00:00:00Z");
const endsAtUnix = Math.floor(endsAt.getTime() / 1000);

type ChildView = {
  type: number;
  content?: string;
  items?: Array<{ media?: { url: string } }>;
  components?: Array<{
    type: number;
    label?: string;
    custom_id?: string;
    disabled?: boolean;
  }>;
};

function promptWith(overrides: Partial<PlayerPrompt> = {}): PlayerPrompt {
  return {
    id: 7,
    question: "What should we build next?",
    description: "Anything goes.",
    createdBy: "1",
    channelId: "2",
    messageId: null,
    rolePingId: null,
    startsAt: new Date("2029-12-01T00:00:00Z"),
    endsAt,
    status: "active",
    entryMode: "single",
    maxEntries: null,
    cooldownSeconds: null,
    createdAt: new Date("2029-12-01T00:00:00Z"),
    updatedAt: new Date("2029-12-01T00:00:00Z"),
    ...overrides,
  };
}

function view(result: { components: unknown[] }) {
  const nodes = (result.components as Array<{ toJSON: () => ChildView }>).map(
    (c) => c.toJSON(),
  );
  const container = nodes.find((n) => n.type === ComponentType.Container);
  if (!container) throw new Error("expected a container");
  const children = (container.components ?? []) as unknown as ChildView[];
  return {
    nodes,
    children,
    texts: children.filter((c) => c.type === ComponentType.TextDisplay),
    button: children.find((c) => c.type === ComponentType.ActionRow)
      ?.components?.[0],
  };
}

describe("PlayerPromptComponentPresets.active", () => {
  it("returns a Components V2 container", () => {
    const result = PlayerPromptComponentPresets.active(promptWith());
    expect(result.flags).toBe(MessageFlags.IsComponentsV2);
    expect(view(result).nodes).toHaveLength(1);
  });

  it("leads with the full-width woodmark banner", () => {
    const { children } = view(
      PlayerPromptComponentPresets.active(promptWith()),
    );
    expect(children[0].type).toBe(ComponentType.MediaGallery);
    expect(children[0].items?.[0]?.media?.url).toContain(
      "createrington-woodmark.png",
    );
  });

  it("renders the question as a heading with the description and closing time", () => {
    const { texts } = view(PlayerPromptComponentPresets.active(promptWith()));
    const joined = texts.map((t) => t.content).join("\n");
    expect(joined).toContain("## What should we build next?");
    expect(joined).toContain("Anything goes.");
    expect(joined).toContain(`<t:${endsAtUnix}:R>`);
  });

  it("labels the button Respond for single-entry prompts", () => {
    const { button } = view(PlayerPromptComponentPresets.active(promptWith()));
    expect(button).toMatchObject({
      custom_id: "prompt:respond:7",
      label: "Respond",
    });
    expect(button?.disabled).toBeFalsy();
  });

  it("labels the button Add entry and spells out the limits for multi prompts", () => {
    const { texts, button } = view(
      PlayerPromptComponentPresets.active(
        promptWith({
          entryMode: "multi",
          maxEntries: 3,
          cooldownSeconds: 3600,
        }),
      ),
    );
    expect(button?.label).toBe("Add entry");
    const joined = texts.map((t) => t.content).join("\n");
    expect(joined).toContain("Up to 3 entries per player");
    expect(joined).toContain("1 hour between them");
  });

  it("describes an uncapped multi prompt as unlimited", () => {
    const { texts } = view(
      PlayerPromptComponentPresets.active(promptWith({ entryMode: "multi" })),
    );
    expect(texts.map((t) => t.content).join("\n")).toContain(
      "Unlimited entries per player",
    );
  });

  it("carries the role ping as a spoilered text display above the container", () => {
    const result = PlayerPromptComponentPresets.active(
      promptWith({ rolePingId: "999" }),
    );
    const { nodes } = view(result);
    expect(nodes[0]).toMatchObject({
      type: ComponentType.TextDisplay,
      content: "||<@&999>||",
    });
  });
});

describe("PlayerPromptComponentPresets.closed", () => {
  it("disables the button and reports the response count", () => {
    const { texts, button } = view(
      PlayerPromptComponentPresets.closed(promptWith({ status: "closed" }), {
        entryCount: 4,
        responderCount: 4,
      }),
    );
    expect(button).toMatchObject({
      custom_id: "prompt:respond:7",
      label: "Responses closed",
      disabled: true,
    });
    expect(texts.map((t) => t.content).join("\n")).toContain(
      "**4 responses** received",
    );
  });

  it("reports entries and unique responders for multi prompts", () => {
    const { texts, button } = view(
      PlayerPromptComponentPresets.closed(
        promptWith({ status: "closed", entryMode: "multi" }),
        { entryCount: 9, responderCount: 1 },
      ),
    );
    expect(button?.label).toBe("Entries closed");
    expect(texts.map((t) => t.content).join("\n")).toContain(
      "**9 entries** from **1 player**",
    );
  });
});
