import type { RouterOutput } from "@/lib/trpc";

export type AdminWorkshopMod =
  RouterOutput["admin"]["workshops"]["listMods"][number];
export type PackMod =
  RouterOutput["admin"]["workshops"]["listPackMods"][number];
export type AttentionItem =
  RouterOutput["admin"]["workshops"]["attention"][number];
export type WorkshopDependency =
  RouterOutput["admin"]["workshops"]["listDependencies"][number];
export type ReleaseMod =
  RouterOutput["admin"]["modpacks"]["listReleaseMods"][number];
export type WorkshopEvent =
  RouterOutput["admin"]["workshops"]["listEvents"]["items"][number];
