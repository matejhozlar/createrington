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

  common: {
    /**
     * Generic confirm button
     */
    confirm(customId: string = "confirm"): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success);
    },

    /**
     * Generic cancel button
     */
    cancel(customId: string = "cancel"): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);
    },

    /**
     * Generic delete button
     */
    delete(customId: string = "delete"): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger);
    },

    /**
     * Generic link button
     */
    link(label: string, url: string): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel(label)
        .setStyle(ButtonStyle.Link)
        .setURL(url);
    },

    /**
     * Help/Support button
     */
    help(url: string = "https://createrington.com/support"): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Get Help")
        .setEmoji("❓")
        .setStyle(ButtonStyle.Link)
        .setURL(url);
    },

    /**
     * Disabled placeholder button
     */
    disabled(label: string): ButtonBuilder {
      return new ButtonBuilder()
        .setCustomId("disabled")
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
    },
  },

  links: {
    /**
     * Main website link
     */
    website(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Visit Website")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.website);
    },

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
     * CurseForge modpack link
     */
    modpack(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open CurseForge")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.modpack);
    },

    /**
     * Server map link
     */
    map(): ButtonBuilder {
      return new ButtonBuilder()
        .setLabel("Open Map")
        .setStyle(ButtonStyle.Link)
        .setURL(cfg.map);
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
