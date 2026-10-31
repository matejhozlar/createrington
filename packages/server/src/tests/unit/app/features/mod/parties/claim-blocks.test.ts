import { describe, it, expect } from "vitest";
import {
  groupClaimBlocks,
  type ClaimChunk,
} from "@/app/features/mod/parties/claim-blocks";

const OWNER = "3f2504e0-4f89-11d3-9a0c-0305e82c3501";
const OTHER = "3f2504e0-4f89-11d3-9a0c-0305e82c3502";
const OVERWORLD = "minecraft:overworld";
const NETHER = "minecraft:the_nether";

function chunk(
  chunkX: number,
  chunkZ: number,
  overrides: Partial<ClaimChunk> = {},
): ClaimChunk {
  return {
    dimension: OVERWORLD,
    ownerUuid: OWNER,
    forceloaded: false,
    chunkX,
    chunkZ,
    ...overrides,
  };
}

describe("groupClaimBlocks", () => {
  it("returns no block for no chunk", () => {
    expect(groupClaimBlocks([])).toEqual([]);
  });

  it("joins edge-adjacent chunks into one block with its bounding box", () => {
    const blocks = groupClaimBlocks([
      chunk(0, 0),
      chunk(1, 0),
      chunk(1, 1, { forceloaded: true }),
      chunk(1, 2),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      dimension: OVERWORLD,
      ownerUuid: OWNER,
      chunkCount: 4,
      forceloadCount: 1,
      minX: 0,
      maxX: 1,
      minZ: 0,
      maxZ: 2,
    });
    expect(blocks[0].chunks).toEqual([
      { x: 0, z: 0, forceloaded: false },
      { x: 1, z: 0, forceloaded: false },
      { x: 1, z: 1, forceloaded: true },
      { x: 1, z: 2, forceloaded: false },
    ]);
  });

  it("keeps chunks touching only at a corner in separate blocks", () => {
    const blocks = groupClaimBlocks([chunk(0, 0), chunk(1, 1)]);
    expect(blocks).toHaveLength(2);
  });

  it("keeps chunks of different owners apart even when adjacent", () => {
    const blocks = groupClaimBlocks([
      chunk(0, 0),
      chunk(1, 0, { ownerUuid: OTHER }),
    ]);
    expect(blocks.map((block) => block.ownerUuid)).toEqual([OWNER, OTHER]);
  });

  it("treats owner UUIDs case-insensitively", () => {
    const blocks = groupClaimBlocks([
      chunk(0, 0),
      chunk(1, 0, { ownerUuid: OWNER.toUpperCase() }),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].chunkCount).toBe(2);
  });

  it("keeps the same coordinates in different dimensions apart", () => {
    const blocks = groupClaimBlocks([
      chunk(0, 0),
      chunk(0, 0, { dimension: NETHER }),
    ]);
    expect(blocks).toHaveLength(2);
  });

  it("orders blocks largest first, then by dimension and position", () => {
    const blocks = groupClaimBlocks([
      chunk(10, 10),
      chunk(0, 0),
      chunk(1, 0),
      chunk(5, 5, { dimension: NETHER }),
      chunk(-3, -3),
    ]);
    expect(
      blocks.map((block) => [block.dimension, block.minX, block.chunkCount]),
    ).toEqual([
      [OVERWORLD, 0, 2],
      [OVERWORLD, -3, 1],
      [OVERWORLD, 10, 1],
      [NETHER, 5, 1],
    ]);
  });
});
