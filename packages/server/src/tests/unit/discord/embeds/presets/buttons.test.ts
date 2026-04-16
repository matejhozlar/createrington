import { describe, it, expect } from "vitest";
import { ButtonStyle } from "discord.js";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";

describe("ButtonPresets.waitlist", () => {
  it("accept(id) builds a green Success button with the right custom id and label", () => {
    const data = ButtonPresets.waitlist.accept(42).toJSON();
    expect(data.style).toBe(ButtonStyle.Success);
    expect(data.label).toBe("Accept");
    expect(data).toMatchObject({ custom_id: "waitlist:accept:42" });
  });

  it("decline(id) builds a red Danger button with the right custom id and label", () => {
    const data = ButtonPresets.waitlist.decline("xyz").toJSON();
    expect(data.style).toBe(ButtonStyle.Danger);
    expect(data.label).toBe("Decline");
    expect(data).toMatchObject({ custom_id: "waitlist:decline:xyz" });
  });
});

describe("ButtonPresets.common", () => {
  it("confirm() defaults to custom_id='confirm' with Success style", () => {
    const data = ButtonPresets.common.confirm().toJSON();
    expect(data).toMatchObject({
      custom_id: "confirm",
      label: "Confirm",
      style: ButtonStyle.Success,
    });
  });

  it("confirm(customId) respects an explicit custom id", () => {
    const data = ButtonPresets.common.confirm("custom-yes").toJSON();
    expect(data).toMatchObject({ custom_id: "custom-yes" });
  });

  it("cancel() defaults to custom_id='cancel' with Secondary style", () => {
    const data = ButtonPresets.common.cancel().toJSON();
    expect(data).toMatchObject({
      custom_id: "cancel",
      label: "Cancel",
      style: ButtonStyle.Secondary,
    });
  });

  it("delete() defaults to custom_id='delete' with Danger style", () => {
    const data = ButtonPresets.common.delete().toJSON();
    expect(data).toMatchObject({
      custom_id: "delete",
      label: "Delete",
      style: ButtonStyle.Danger,
    });
  });

  it("link(label, url) builds a Link button with no custom id", () => {
    const data = ButtonPresets.common
      .link("Docs", "https://example.com")
      .toJSON();
    expect(data.style).toBe(ButtonStyle.Link);
    expect(data.label).toBe("Docs");
    expect(data).toMatchObject({ url: "https://example.com" });
    expect(data).not.toHaveProperty("custom_id");
  });

  it("help() defaults to the documented support URL", () => {
    const data = ButtonPresets.common.help().toJSON();
    expect(data.style).toBe(ButtonStyle.Link);
    expect(data.label).toBe("Get Help");
    expect(data).toMatchObject({ url: "https://create-rington.com/support" });
  });

  it("help(url) accepts a custom URL override", () => {
    const data = ButtonPresets.common
      .help("https://other.example/help")
      .toJSON();
    expect(data).toMatchObject({ url: "https://other.example/help" });
  });

  it("disabled(label) builds a Secondary button flagged as disabled", () => {
    const data = ButtonPresets.common.disabled("Locked").toJSON();
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
      const data = factory().toJSON();
      expect(data.style).toBe(ButtonStyle.Link);
      expect(data).toHaveProperty("url");
    }
  });
});

describe("ButtonPresets.departedMember", () => {
  it("deleteNow(id) builds a Danger button namespaced to the departed id", () => {
    const data = ButtonPresets.departedMember.deleteNow(7).toJSON();
    expect(data.style).toBe(ButtonStyle.Danger);
    expect(data).toMatchObject({ custom_id: "departed:delete-now:7" });
    expect(data.label).toContain("Yeet");
  });
});
