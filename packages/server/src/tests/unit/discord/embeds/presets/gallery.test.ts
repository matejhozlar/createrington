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

describe("GalleryEmbedPresets.approvalAnnouncement", () => {
  const base = {
    authorDiscordId: "123",
    caption: "Central station",
    creditNames: [],
    imageUrl: "https://cdn.test/shot.webp",
    galleryUrl: "https://createrington.test/gallery",
  };

  it("omits the reward line when nothing was paid", () => {
    expect(
      text(
        GalleryEmbedPresets.approvalAnnouncement({
          ...base,
          rewardAmount: 1250,
        }),
      ),
    ).toContain("Reward: **$1,250**");
    expect(
      text(
        GalleryEmbedPresets.approvalAnnouncement({ ...base, rewardAmount: 0 }),
      ),
    ).not.toContain("Reward");
  });
});
