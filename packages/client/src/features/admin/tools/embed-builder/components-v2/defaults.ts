import type {
  ComponentActionRow,
  ComponentButton,
  ComponentContainer,
  ComponentMediaGallery,
  ComponentSection,
  ComponentSeparator,
  ComponentTextDisplay,
} from "@createrington/shared/api/embed";

export function newButton(): ComponentButton {
  return { type: "button", label: "Button", url: "" };
}

export function newTextDisplay(): ComponentTextDisplay {
  return { type: "text", content: "" };
}

export function newSeparator(): ComponentSeparator {
  return { type: "separator", divider: true, spacing: 1 };
}

export function newMediaGallery(): ComponentMediaGallery {
  return { type: "media_gallery", items: [{ url: "", spoiler: false }] };
}

export function newActionRow(): ComponentActionRow {
  return { type: "action_row", components: [newButton()] };
}

export function newSection(): ComponentSection {
  return {
    type: "section",
    components: [newTextDisplay()],
    accessory: { type: "thumbnail", url: "", spoiler: false },
  };
}

export function newContainer(): ComponentContainer {
  return { type: "container", spoiler: false, components: [newTextDisplay()] };
}

export function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
