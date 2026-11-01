import { colorHex } from "@createrington/shared/team-tag";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chunkBluemapUrl } from "@/lib/minecraft";
import type { ClaimBlock } from "../claims";

const CELL_PX = 22;
const GAP = 0.1;
const NO_PARTY_FILL = "#9ca3af";

export function ClaimBlockGrid({
  block,
  highlight,
}: {
  block: ClaimBlock;
  highlight: { chunkX: number; chunkZ: number } | null;
}) {
  const width = block.maxX - block.minX + 1;
  const height = block.maxZ - block.minZ + 1;
  const fill = block.party ? `#${colorHex(block.party.color)}` : NO_PARTY_FILL;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${block.chunkCount} claimed chunks`}
      className="block h-auto rounded-md bg-muted/40"
      style={{ width: width * CELL_PX, maxWidth: "100%" }}
    >
      {block.chunks.map((chunk) => {
        const highlighted =
          highlight?.chunkX === chunk.x && highlight?.chunkZ === chunk.z;
        return (
          <Tooltip key={`${chunk.x},${chunk.z}`}>
            <TooltipTrigger asChild>
              <a
                href={chunkBluemapUrl(block.dimension, chunk.x, chunk.z)}
                target="_blank"
                rel="noreferrer"
                className="opacity-80 transition-opacity hover:opacity-100"
              >
                <rect
                  x={chunk.x - block.minX + GAP / 2}
                  y={chunk.z - block.minZ + GAP / 2}
                  width={1 - GAP}
                  height={1 - GAP}
                  rx={0.12}
                  fill={fill}
                  stroke={highlighted || chunk.forceloaded ? "white" : "none"}
                  strokeWidth={highlighted ? 0.18 : 0.08}
                  strokeOpacity={highlighted ? 1 : 0.7}
                />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              Chunk {chunk.x}, {chunk.z}
              {chunk.forceloaded && " · forceloaded"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </svg>
  );
}
