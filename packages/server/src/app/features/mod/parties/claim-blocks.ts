export interface ClaimChunk {
  dimension: string;
  chunkX: number;
  chunkZ: number;
  ownerUuid: string;
  forceloaded: boolean;
}

export interface ClaimBlockChunk {
  x: number;
  z: number;
  forceloaded: boolean;
}

export interface ClaimBlock {
  dimension: string;
  ownerUuid: string;
  chunkCount: number;
  forceloadCount: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  chunks: ClaimBlockChunk[];
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function chunkKey(x: number, z: number): string {
  return `${x},${z}`;
}

function compareChunks(a: ClaimBlockChunk, b: ClaimBlockChunk): number {
  return a.z - b.z || a.x - b.x;
}

function compareBlocks(a: ClaimBlock, b: ClaimBlock): number {
  return (
    b.chunkCount - a.chunkCount ||
    a.dimension.localeCompare(b.dimension) ||
    a.minZ - b.minZ ||
    a.minX - b.minX
  );
}

/**
 * Groups claimed chunks into blocks of edge-adjacent chunks sharing an owner
 * and a dimension. Blocks come back largest first; chunks inside a block are
 * ordered by z then x so a grid can be drawn row by row.
 */
export function groupClaimBlocks(chunks: ClaimChunk[]): ClaimBlock[] {
  const groups = new Map<string, Map<string, ClaimChunk>>();
  for (const chunk of chunks) {
    const groupKey = `${chunk.dimension}\u0000${chunk.ownerUuid.toLowerCase()}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = new Map();
      groups.set(groupKey, group);
    }
    group.set(chunkKey(chunk.chunkX, chunk.chunkZ), chunk);
  }

  const blocks: ClaimBlock[] = [];
  for (const group of groups.values()) {
    const remaining = new Map(group);
    while (remaining.size > 0) {
      const [startKey, start] = remaining.entries().next().value as [
        string,
        ClaimChunk,
      ];
      remaining.delete(startKey);
      const stack = [start];
      const members: ClaimBlockChunk[] = [];
      while (stack.length > 0) {
        const current = stack.pop() as ClaimChunk;
        members.push({
          x: current.chunkX,
          z: current.chunkZ,
          forceloaded: current.forceloaded,
        });
        for (const [dx, dz] of NEIGHBOURS) {
          const key = chunkKey(current.chunkX + dx, current.chunkZ + dz);
          const neighbour = remaining.get(key);
          if (neighbour) {
            remaining.delete(key);
            stack.push(neighbour);
          }
        }
      }
      members.sort(compareChunks);
      blocks.push({
        dimension: start.dimension,
        ownerUuid: start.ownerUuid,
        chunkCount: members.length,
        forceloadCount: members.filter((chunk) => chunk.forceloaded).length,
        minX: Math.min(...members.map((chunk) => chunk.x)),
        maxX: Math.max(...members.map((chunk) => chunk.x)),
        minZ: Math.min(...members.map((chunk) => chunk.z)),
        maxZ: Math.max(...members.map((chunk) => chunk.z)),
        chunks: members,
      });
    }
  }

  return blocks.sort(compareBlocks);
}
