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

export const CommonComponentPresets = {
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
