import type { RouterOutput } from "@/lib/trpc";

export type StructurePackMod =
  RouterOutput["admin"]["structurePacks"]["get"]["mods"][number];

export interface RemoveTarget {
  modId: number;
  modName: string;
  fileName: string;
}
