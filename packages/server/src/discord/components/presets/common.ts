import { container, text } from "../component-builder";
import { ComponentColors } from "../colors";
import { Discord } from "@/discord/constants";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

/**
 * Reusable Components V2 presets for common response patterns. Each returns a
 * `ComponentsData` tree; pass it to `buildComponentsMessage` before sending.
 */
export const CommonComponentPresets = {
  /** A green-accented success container */
  success(title: string, description?: string): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`✅ **${title}**`),
    ];
    if (description) children.push(text(description));
    return {
      components: [
        container(children, { accentColor: ComponentColors.Success }),
      ],
    };
  },

  /** A red-accented error container */
  error(title: string, description?: string): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`❌ **${title}**`),
    ];
    if (description) children.push(text(description));
    return {
      components: [container(children, { accentColor: ComponentColors.Error })],
    };
  },

  /** A red-accented error container with an admin contact prompt appended */
  errorWithAdmin(title: string, description?: string): ComponentsData {
    const contact = `If this issue persists, please contact ${Discord.Roles.mention(
      Discord.Roles.ADMIN,
    )}`;
    const children: ComponentContainer["components"] = [
      text(`❌ **${title}**`),
    ];
    if (description) children.push(text(description));
    children.push(text(contact));
    return {
      components: [container(children, { accentColor: ComponentColors.Error })],
    };
  },

  /** A blue-accented info container */
  info(title: string, description?: string): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`ℹ️ **${title}**`),
    ];
    if (description) children.push(text(description));
    return {
      components: [container(children, { accentColor: ComponentColors.Info })],
    };
  },

  /** A bare container with optional title, description, and accent override */
  plain(data: {
    title?: string;
    description?: string;
    accentColor?: number;
  }): ComponentsData {
    const children: ComponentContainer["components"] = [];
    if (data.title) children.push(text(`**${data.title}**`));
    if (data.description) children.push(text(data.description));
    return {
      components: [
        container(children, {
          accentColor: data.accentColor ?? ComponentColors.Info,
        }),
      ],
    };
  },

  /** A loading/processing container */
  loading(message: string = "Processing..."): ComponentsData {
    return {
      components: [
        container([text("⏳ **Please wait**"), text(message)], {
          accentColor: ComponentColors.Info,
        }),
      ],
    };
  },
};
