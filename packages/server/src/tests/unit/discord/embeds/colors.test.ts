import { describe, it, expect } from "vitest";
import { EmbedColors } from "@/discord/embeds/colors";
import config from "@/config";

describe("EmbedColors", () => {
  it("maps semantic names to the configured palette values", () => {
    expect(EmbedColors.Neutral).toBe(config.discord.embeds.colors.GRAY);
    expect(EmbedColors.Success).toBe(config.discord.embeds.colors.GREEN);
    expect(EmbedColors.Error).toBe(config.discord.embeds.colors.RED);
    expect(EmbedColors.Warning).toBe(config.discord.embeds.colors.ORANGE);
    expect(EmbedColors.Info).toBe(config.discord.embeds.colors.BLUE);
    expect(EmbedColors.Loading).toBe(config.discord.embeds.colors.GRAY);
    expect(EmbedColors.Moderation).toBe(config.discord.embeds.colors.DARK_RED);
    expect(EmbedColors.System).toBe(config.discord.embeds.colors.PURPLE);
    expect(EmbedColors.Premium).toBe(config.discord.embeds.colors.GOLD);
  });

  it("Neutral and Loading both alias the GRAY color", () => {
    expect(EmbedColors.Neutral).toBe(EmbedColors.Loading);
  });

  it("exposes every documented semantic key", () => {
    expect(Object.keys(EmbedColors).sort()).toEqual(
      [
        "Error",
        "Info",
        "Loading",
        "Moderation",
        "Neutral",
        "Premium",
        "Success",
        "System",
        "Warning",
      ].sort(),
    );
  });
});
