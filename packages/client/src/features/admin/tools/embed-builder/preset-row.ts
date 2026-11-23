import type { RouterOutput } from "@/lib/trpc";

export type PresetRow =
  RouterOutput["admin"]["embeds"]["presets"]["list"]["items"][number];
