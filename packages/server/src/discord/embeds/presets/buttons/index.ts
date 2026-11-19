import config from "@/config";
import { siteUrl } from "@/config/site-url";
import { encodeStatParam } from "@createrington/shared/minecraft-stats";
import { ButtonBuilder, ButtonStyle } from "discord.js";

const cfg = config.meta.links;

export const ButtonPresets = {
  links: {
    adminPanel(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open Admin Panel")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.adminPanel);
    },

    map(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open the Map")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.map);
    },

    leaderboard(stat?: { category: string; item: string }): ButtonBuilder {
      const url = new URL(siteUrl("/leaderboards"));
      if (stat) url.searchParams.set("stat", encodeStatParam(stat));
      url.hash = "boards";
      return new ButtonBuilder()
        .setLabel("View full leaderboard")
        .setStyle(ButtonStyle.Link)
        .setURL(url.toString());
    },

    compare(firstUsername: string, secondUsername: string): ButtonBuilder {
      const url = new URL(siteUrl("/leaderboards/compare"));
      url.searchParams.set("a", firstUsername);
      url.searchParams.set("b", secondUsername);
      return new ButtonBuilder()
        .setLabel("View full comparison")
        .setStyle(ButtonStyle.Link)
        .setURL(url.toString());
    },

    teamTag(code: string): ButtonBuilder {
      const url = new URL(siteUrl("/team-tag"));
      url.searchParams.set("design", code);
      return new ButtonBuilder()
        .setLabel("Open in the editor")
        .setStyle(ButtonStyle.Link)
        .setURL(url.toString());
    },

    vote(minecraftUsername: string): ButtonBuilder {
      const url = new URL(cfg.vote);
      url.searchParams.set("username", minecraftUsername);
      return new ButtonBuilder()
        .setLabel("Vote for Createrington")
        .setStyle(ButtonStyle.Link)
        .setURL(url.toString());
    },
  },

  departedMember: {
    deleteNow(departedId: number): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(`departed:delete-now:${departedId}`)
        .setLabel("Yeet from Database 🚀")
        .setStyle(ButtonStyle.Danger);
    },
  },
};
