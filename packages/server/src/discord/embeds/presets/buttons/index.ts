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
  /**
   * Waitlist action buttons
   */
  waitlist: {
    /**
     * Accept button for waitlist entires
     */
    accept(id: number | string): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(`waitlist:accept:${id}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success);
    },

    /**
     * Decline button for waitlist entries
     */
    decline(id: number | string): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(`waitlist:decline:${id}`)
        .setLabel("Decline")
        .setStyle(ButtonStyle.Danger);
    },
  },

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
