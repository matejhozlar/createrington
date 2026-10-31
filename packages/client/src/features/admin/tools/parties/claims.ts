import type { RouterOutput } from "@/lib/trpc";

export type ClaimBlocksResult = NonNullable<
  RouterOutput["admin"]["parties"]["claimBlocks"]
>;
export type ClaimBlock = ClaimBlocksResult["blocks"][number];

export function blockKey(block: ClaimBlock): string {
  const first = block.chunks[0];
  return `${block.dimension}:${block.ownerUuid}:${first.x}:${first.z}`;
}

export function parseCoordinateSearch(
  search: string,
): { chunkX: number; chunkZ: number } | null {
  const tokens = search
    .replace(/[xz=:,]/gi, " ")
    .trim()
    .split(/\s+/);
  if (tokens.length !== 2 || !tokens.every((t) => /^-?\d+$/.test(t))) {
    return null;
  }
  return {
    chunkX: Math.floor(Number(tokens[0]) / 16),
    chunkZ: Math.floor(Number(tokens[1]) / 16),
  };
}

export function blockContains(
  block: ClaimBlock,
  chunkX: number,
  chunkZ: number,
): boolean {
  if (
    chunkX < block.minX ||
    chunkX > block.maxX ||
    chunkZ < block.minZ ||
    chunkZ > block.maxZ
  ) {
    return false;
  }
  return block.chunks.some((chunk) => chunk.x === chunkX && chunk.z === chunkZ);
}

export function blockMatchesText(block: ClaimBlock, needle: string): boolean {
  if (!block.party) {
    return (
      "no party".includes(needle) ||
      block.ownerUuid.toLowerCase().includes(needle)
    );
  }
  return (
    block.party.name.toLowerCase().includes(needle) ||
    (block.party.tag?.toLowerCase().includes(needle) ?? false) ||
    (block.party.ownerName?.toLowerCase().includes(needle) ?? false)
  );
}

export function blockMatches(block: ClaimBlock, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const coords = parseCoordinateSearch(needle);
  if (coords) return blockContains(block, coords.chunkX, coords.chunkZ);
  return blockMatchesText(block, needle);
}
