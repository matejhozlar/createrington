import { describe, it, expect } from "vitest";
import { GalleryEmbedPresets } from "@/discord/embeds/presets/gallery";

function text(embed: { build: () => { data: { description?: string } } }) {
  return embed.build().data.description ?? "";
}

describe("GalleryEmbedPresets.intakeNotice", () => {
  it("states the reward as in-game currency, never as coins", () => {
    const description = text(GalleryEmbedPresets.intakeNotice(50));

    expect(description).toContain("$50");
    expect(description).toContain("in-game currency");
    expect(description).not.toMatch(/coins?/i);
  });

  it("drops the reward sentence when the reward is switched off", () => {
    const description = text(GalleryEmbedPresets.intakeNotice(0));

    expect(description).not.toContain("$");
    expect(description).toContain("credit to you");
  });

  it("carries the submission rules", () => {
    const description = text(GalleryEmbedPresets.intakeNotice(50));

    expect(description).toContain("Rules");
    expect(description).toMatch(/shaders/i);
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

  it("formats the reward as currency", () => {
    const description = text(
      GalleryEmbedPresets.approvalAnnouncement({ ...base, rewardAmount: 1250 }),
    );

    expect(description).toContain("$1,250");
    expect(description).not.toMatch(/coins?/i);
  });

  it("omits the reward line when nothing was paid", () => {
    const description = text(
      GalleryEmbedPresets.approvalAnnouncement({ ...base, rewardAmount: 0 }),
    );

    expect(description).not.toContain("Reward");
    expect(description).toContain("<@123>");
  });
});
