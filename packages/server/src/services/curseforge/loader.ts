import { CurseForgeModLoaderType } from "@createrington/content-gateway-client";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

export const CurseForgeLoader = {
  forge: CurseForgeModLoaderType.forge,
  fabric: CurseForgeModLoaderType.fabric,
  quilt: CurseForgeModLoaderType.quilt,
  neoforge: CurseForgeModLoaderType.neoForge,
} as const;

export type CurseForgeLoaderName = keyof typeof CurseForgeLoader;

const LOADER_LABELS: Record<CurseForgeLoaderName, string> = {
  forge: "Forge",
  neoforge: "NeoForge",
  fabric: "Fabric",
  quilt: "Quilt",
};

export const LOADERLESS_CLASSES: ReadonlySet<number> = new Set([
  CURSEFORGE_CLASSES.shaders,
  CURSEFORGE_CLASSES.resourcePacks,
]);

export interface ParsedLoaderId {
  id: string;
  name: string;
  version: string;
}

function isLoaderName(name: string): name is CurseForgeLoaderName {
  return Object.hasOwn(CurseForgeLoader, name);
}

export function parseLoaderId(loaderId: string): ParsedLoaderId | null {
  const separator = loaderId.indexOf("-");
  if (separator <= 0 || separator === loaderId.length - 1) return null;
  return {
    id: loaderId,
    name: loaderId.slice(0, separator).toLowerCase(),
    version: loaderId.slice(separator + 1),
  };
}

export function loaderTypeOf(loaderId: string): number | null {
  const name = parseLoaderId(loaderId)?.name;
  return name && isLoaderName(name) ? CurseForgeLoader[name] : null;
}

export function loaderLabel(loaderId: string): string {
  const parsed = parseLoaderId(loaderId);
  const name = parsed ? loaderId.slice(0, loaderId.indexOf("-")) : loaderId;
  const key = name.toLowerCase();
  const label = isLoaderName(key) ? LOADER_LABELS[key] : name;
  return parsed ? `${label} ${parsed.version}` : label;
}
