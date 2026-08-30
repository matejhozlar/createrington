export type ChatLayout = "docked" | "expanded" | "fullscreen";

export function readingColumnClass(layout: ChatLayout): string | undefined {
  if (layout === "docked") return "mx-auto w-full max-w-(--chat-column-w)";
  if (layout === "expanded") {
    return "mx-auto w-full max-w-(--chat-column-w) transition-[max-width] delay-100 duration-200 ease-out";
  }
  return undefined;
}
