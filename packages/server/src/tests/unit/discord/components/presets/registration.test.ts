import { describe, it, expect } from "vitest";
import { ComponentType, MessageFlags } from "discord.js";
import {
  REGISTER_CLOSE_BUTTON_ID,
  RegistrationComponentPresets,
} from "@/discord/components/presets/registration";
import { ComponentColors } from "@/discord/components/colors";

type ChildView = {
  type: number;
  content?: string;
  components?: Array<{ type: number; custom_id?: string }>;
};

type ContainerView = {
  type: number;
  accent_color?: number;
  components?: ChildView[];
};

function view(result: { components: unknown[] }) {
  const nodes = (result.components as Array<{ toJSON: () => ContainerView }>)
    .map((c) => c.toJSON())
    .filter((n) => n.type === ComponentType.Container);
  const container = nodes[0];
  if (!container) throw new Error("expected a container");
  const children = container.components ?? [];
  return {
    container,
    children,
    texts: children.filter((c) => c.type === ComponentType.TextDisplay),
  };
}

describe("RegistrationComponentPresets.closing", () => {
  it("returns a red Components V2 container announcing the deletion", () => {
    const result = RegistrationComponentPresets.closing();

    expect(result.flags).toBe(MessageFlags.IsComponentsV2);

    const { container, texts } = view(result);
    expect(container.accent_color).toBe(ComponentColors.Error);
    expect(texts[0]?.content).toContain("Channel Deletion");
    expect(texts[1]?.content).toContain("deleted");
  });

  it("drops the close button so the card can't be clicked again", () => {
    const { children } = view(RegistrationComponentPresets.closing());

    expect(children.some((c) => c.type === ComponentType.ActionRow)).toBe(
      false,
    );
  });
});

describe("RegistrationComponentPresets.success", () => {
  it("carries the close button the closing card replaces", () => {
    const result = RegistrationComponentPresets.success("Steve", "uuid-1", 0);

    expect(result.flags).toBe(MessageFlags.IsComponentsV2);

    const { children } = view(result);
    const row = children.find((c) => c.type === ComponentType.ActionRow);
    expect(row?.components?.[0]?.custom_id).toBe(REGISTER_CLOSE_BUTTON_ID);
  });
});
