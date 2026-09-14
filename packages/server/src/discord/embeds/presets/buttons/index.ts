import config from "@/config";
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

  gallery: {
    /**
     * Lets the author (or an admin) pull an approved screenshot from the gallery
     */
    remove(submissionId: number): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(`gallery:remove:${submissionId}`)
        .setLabel("Remove from gallery")
        .setStyle(ButtonStyle.Secondary);
    },

    /**
     * Link to the website gallery
     */
    open(url: string): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open gallery")
        .setStyle(ButtonStyle.Link)
        .setURL(url);
    },
  },
};
