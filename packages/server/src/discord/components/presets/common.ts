import { container, text } from "../component-builder";
import { ComponentColors } from "../colors";
import { Discord } from "@/discord/constants";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

function stripe(accentColor: number, accent?: boolean) {
  return accent ? { accentColor } : {};
}

type AccentOptions = { accent?: boolean };

/**
 * Reusable Components V2 presets for common response patterns. Each returns a
 * `ComponentsData` tree; pass it to `buildComponentsMessage` before sending.
 * Containers are stripeless by default; pass `{ accent: true }` to add the
 * semantic colored stripe.
 */
export const CommonComponentPresets = {
  /** A success container, optionally green-accented */
  success(
    title: string,
    description?: string,
    options: AccentOptions = {},
  ): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`✅ **${title}**`),
    ];
    if (description) children.push(text(description));
    return {
      components: [
        container(children, stripe(ComponentColors.Success, options.accent)),
      ],
    };
  },

  /** An error container, optionally red-accented */
  error(
    title: string,
    description?: string,
    options: AccentOptions = {},
  ): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`❌ **${title}**`),
    ];
    if (description) children.push(text(description));
    return {
      components: [
        container(children, stripe(ComponentColors.Error, options.accent)),
      ],
    };
  },

  /** An error container with an admin contact prompt appended */
  errorWithAdmin(
    title: string,
    description?: string,
    options: AccentOptions = {},
  ): ComponentsData {
    const contact = `If this issue persists, please contact ${Discord.Roles.mention(
      Discord.Roles.ADMIN,
    )}`;
    const children: ComponentContainer["components"] = [
      text(`❌ **${title}**`),
    ];
    if (description) children.push(text(description));
    children.push(text(contact));
    return {
      components: [
        container(children, stripe(ComponentColors.Error, options.accent)),
      ],
    };
  },

  /** An info container, optionally blue-accented */
  info(
    title: string,
    description?: string,
    options: AccentOptions = {},
  ): ComponentsData {
    const children: ComponentContainer["components"] = [
      text(`ℹ️ **${title}**`),
    ];
    if (description) children.push(text(description));
    return {
      components: [
        container(children, stripe(ComponentColors.Info, options.accent)),
      ],
    };
  },

  /** A bare container with a title and/or description and an optional stripe */
  plain(
    data: { accentColor?: number } & (
      | { title: string; description?: string }
      | { title?: string; description: string }
    ),
  ): ComponentsData {
    const children: ComponentContainer["components"] = [];
    if (data.title) children.push(text(`**${data.title}**`));
    if (data.description) children.push(text(data.description));
    return {
      components: [
        container(
          children,
          data.accentColor !== undefined
            ? { accentColor: data.accentColor }
            : {},
        ),
      ],
    };
  },

  /** A loading/processing container, optionally gray-accented */
  loading(
    message: string = "Processing...",
    options: AccentOptions = {},
  ): ComponentsData {
    return {
      components: [
        container(
          [text("⏳ **Please wait**"), text(message)],
          stripe(ComponentColors.Loading, options.accent),
        ),
      ],
    };
  },
};
