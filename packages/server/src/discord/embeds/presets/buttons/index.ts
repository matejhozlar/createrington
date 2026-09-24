import config from "@/config";
import { encodeStatParam } from "@createrington/shared/minecraft-stats";
import { ButtonBuilder, ButtonStyle } from "discord.js";

const cfg = config.meta.links;

/**
 * Reusable button presets for common actions
 *
 * These can be imported and used across different embed presets
 * to maintain consistency and reduce duplication
 */
export const ButtonPresets = {
  links: {
    /**
     * Admin panel link
     */
    adminPanel(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open Admin Panel")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.adminPanel);
    },

    /**
     * Live BlueMap of the server
     */
    map(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open the Map")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.map);
    },

    /**
     * Website leaderboards scrolled to the ranked boards, optionally opened on one stat
     */
    leaderboard(stat?: { category: string; item: string }): ButtonBuilder {
      const url = new URL(`${cfg.website.replace(/\/+$/, "")}/leaderboards`);
      if (stat) url.searchParams.set("stat", encodeStatParam(stat));
      url.hash = "boards";
      return new ButtonBuilder()
        .setLabel("View full leaderboard")
        .setStyle(ButtonStyle.Link)
        .setURL(url.toString());
    },

    /**
     * Website head-to-head comparison of two players, by Minecraft username
     */
    compare(firstUsername: string, secondUsername: string): ButtonBuilder {
      const url = new URL(
        `${cfg.website.replace(/\/+$/, "")}/leaderboards/compare`,
      );
      url.searchParams.set("a", firstUsername);
      url.searchParams.set("b", secondUsername);
      return new ButtonBuilder()
        .setLabel("View full comparison")
        .setStyle(ButtonStyle.Link)
        .setURL(url.toString());
    },

    /**
     * Server-list vote page, prefilled with the player's Minecraft username
     */
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
    /**
     * Button to immediately delete a departed member
     */
    deleteNow(departedId: number): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(`departed:delete-now:${departedId}`)
        .setLabel("Yeet from Database 🚀")
        .setStyle(ButtonStyle.Danger);
    },
  },
};
