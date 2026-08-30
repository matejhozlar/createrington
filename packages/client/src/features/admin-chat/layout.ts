export type ChatLayout = "docked" | "expanded" | "fullscreen";

export function readingColumnClass(layout: ChatLayout): string | undefined {
  return layout === "expanded" ? "mx-auto w-full max-w-3xl" : undefined;
}
