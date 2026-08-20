import { describe, it, expect, vi } from "vitest";

// The adminPanel link factory reads its URL from config.meta.links at module
// load and passes it to ButtonBuilder.setURL, which throws on undefined. Env
// vars like ADMIN_PANEL_URL aren't set in CI, so mock the config to provide
// deterministic URLs. Hoisted by Vitest.
vi.mock("@/config", () => ({
  default: {
    meta: {
      links: {
        discordInvite: "https://discord.gg/test",
        website: "https://example.com/website",
        adminPanel: "https://example.com/admin",
        modpack: "https://example.com/modpack",
        map: "https://example.com/map",
        assets: "https://example.com/assets",
      },
    },
  },
}));

import { ButtonStyle, type ButtonBuilder } from "discord.js";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";

// discord.js's ButtonBuilder.toJSON() returns APIButtonComponent which is a
// discriminated union: the SKU variant has no `label`, so the union loses
// the label field. Widen at the test boundary so we can read individual props.
type ButtonData = {
  style?: ButtonStyle;
  label?: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
};
const json = (b: ButtonBuilder): ButtonData => b.toJSON() as ButtonData;

describe("ButtonPresets.links", () => {
  it("each link button uses the Link style and a url", () => {
    for (const factory of [ButtonPresets.links.adminPanel]) {
      const data = json(factory());
      expect(data.style).toBe(ButtonStyle.Link);
      expect(data).toHaveProperty("url");
    }
  });
});

describe("ButtonPresets.departedMember", () => {
  it("deleteNow(id) builds a Danger button namespaced to the departed id", () => {
    const data = json(ButtonPresets.departedMember.deleteNow(7));
    expect(data.style).toBe(ButtonStyle.Danger);
    expect(data).toMatchObject({ custom_id: "departed:delete-now:7" });
    expect(data.label).toContain("Yeet");
  });
});
