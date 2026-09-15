import { describe, it, expect } from "vitest";
import { GalleryEmbedPresets } from "@/discord/embeds/presets/gallery";

function text(embed: { build: () => { data: { description?: string } } }) {
  return embed.build().data.description ?? "";
}

describe("GalleryEmbedPresets.intakeNotice", () => {
  it("drops the reward sentence when the reward is switched off", () => {
    expect(text(GalleryEmbedPresets.intakeNotice(50))).toMatch(/earn \*\*\$50/);
    expect(text(GalleryEmbedPresets.intakeNotice(0))).not.toMatch(/earn/i);
  });
});
