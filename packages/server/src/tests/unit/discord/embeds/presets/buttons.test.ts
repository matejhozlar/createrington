import { describe, it, expect, vi } from "vitest";

// The link button factories (website/adminPanel/modpack/map) read URLs from
// config.meta.links at module load and pass them to ButtonBuilder.setURL,
// which throws on undefined. Env vars like WEBSITE_URL aren't set in CI, so
// mock the config to provide deterministic URLs. Hoisted by Vitest.
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
// discriminated union — the SKU variant has no `label`, so the union loses
// the label field. Widen at the test boundary so we can read individual props.
type ButtonData = {
  style?: ButtonStyle;
  label?: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
};
const json = (b: ButtonBuilder): ButtonData => b.toJSON() as ButtonData;

describe("ButtonPresets.waitlist", () => {
  it("accept(id) builds a green Success button with the right custom id and label", () => {
    const data = json(ButtonPresets.waitlist.accept(42));
    expect(data.style).toBe(ButtonStyle.Success);
    expect(data.label).toBe("Accept");
    expect(data).toMatchObject({ custom_id: "waitlist:accept:42" });
  });

  it("decline(id) builds a red Danger button with the right custom id and label", () => {
    const data = json(ButtonPresets.waitlist.decline("xyz"));
    expect(data.style).toBe(ButtonStyle.Danger);
    expect(data.label).toBe("Decline");
    expect(data).toMatchObject({ custom_id: "waitlist:decline:xyz" });
  });
});

describe("ButtonPresets.common", () => {
  it("confirm() defaults to custom_id='confirm' with Success style", () => {
    const data = json(ButtonPresets.common.confirm());
    expect(data).toMatchObject({
      custom_id: "confirm",
      label: "Confirm",
      style: ButtonStyle.Success,
    });
  });

  it("confirm(customId) respects an explicit custom id", () => {
    const data = json(ButtonPresets.common.confirm("custom-yes"));
    expect(data).toMatchObject({ custom_id: "custom-yes" });
  });

  it("cancel() defaults to custom_id='cancel' with Secondary style", () => {
    const data = json(ButtonPresets.common.cancel());
    expect(data).toMatchObject({
      custom_id: "cancel",
      label: "Cancel",
      style: ButtonStyle.Secondary,
    });
  });

  it("delete() defaults to custom_id='delete' with Danger style", () => {
    const data = json(ButtonPresets.common.delete());
    expect(data).toMatchObject({
      custom_id: "delete",
      label: "Delete",
      style: ButtonStyle.Danger,
    });
  });

  it("link(label, url) builds a Link button with no custom id", () => {
    const data = json(ButtonPresets.common.link("Docs", "https://example.com"));
    expect(data.style).toBe(ButtonStyle.Link);
    expect(data.label).toBe("Docs");
    expect(data).toMatchObject({ url: "https://example.com" });
    expect(data).not.toHaveProperty("custom_id");
  });

  it("help() defaults to the documented support URL", () => {
    const data = json(ButtonPresets.common.help());
    expect(data.style).toBe(ButtonStyle.Link);
    expect(data.label).toBe("Get Help");
    expect(data).toMatchObject({ url: "https://createrington.com/support" });
  });

  it("help(url) accepts a custom URL override", () => {
    const data = json(ButtonPresets.common.help("https://other.example/help"));
    expect(data).toMatchObject({ url: "https://other.example/help" });
  });

  it("disabled(label) builds a Secondary button flagged as disabled", () => {
    const data = json(ButtonPresets.common.disabled("Locked"));
    expect(data).toMatchObject({
      custom_id: "disabled",
      label: "Locked",
      style: ButtonStyle.Secondary,
      disabled: true,
    });
  });
});

describe("ButtonPresets.links", () => {
  it("each link button uses the Link style and a url", () => {
    for (const factory of [
      ButtonPresets.links.website,
      ButtonPresets.links.adminPanel,
      ButtonPresets.links.modpack,
      ButtonPresets.links.map,
    ]) {
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
