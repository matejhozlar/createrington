export const DIMENSIONS = [
  { id: "minecraft:overworld", label: "Overworld" },
  { id: "minecraft:the_nether", label: "Nether" },
  { id: "minecraft:the_end", label: "The End" },
] as const;

const DIMENSION_LABELS: Record<string, string> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.id, d.label]),
);

export function formatDimension(dimension: string | null | undefined): string {
  if (!dimension) return "Unknown";
  return (
    DIMENSION_LABELS[dimension] ??
    dimension
      .replace(/^[^:]+:/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function chunkCenterToBlock(chunk: number): number {
  return chunk * 16 + 8;
}

export function regionFileName(chunkX: number, chunkZ: number): string {
  return `r.${chunkX >> 5}.${chunkZ >> 5}.mca`;
}

export function tpCommand(
  dimension: string,
  x: number,
  y: number,
  z: number,
): string {
  return `/execute in ${dimension} run tp @s ${x} ${y} ${z}`;
}

export function chunkTpCommand(
  dimension: string,
  chunkX: number,
  chunkZ: number,
): string {
  return tpCommand(
    dimension,
    chunkCenterToBlock(chunkX),
    100,
    chunkCenterToBlock(chunkZ),
  );
}
