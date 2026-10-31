import { useMemo, useState } from "react";
import { colorHex } from "@createrington/shared/team-tag";
import { ChevronDown, Map as MapIcon, Search } from "lucide-react";
import { ChoiceField } from "@/components/choice-field";
import { Loading } from "@/components/loading-spinner";
import { TeamTagPlate } from "@/components/team-tag-plate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeDateSafe } from "@/features/admin/format";
import { useToastActions } from "@/hooks/use-toast";
import {
  DIMENSIONS,
  chunkBluemapUrl,
  chunkCenterToBlock,
  chunkTpCommand,
  formatDimension,
} from "@/lib/minecraft";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  blockKey,
  blockMatches,
  parseCoordinateSearch,
  type ClaimBlock,
} from "../claims";
import { ClaimBlockGrid } from "./ClaimBlockGrid";

const COPY = {
  title: "Claimed chunks",
  description:
    "Every claimed chunk on the server grouped into blocks of touching chunks. Click a block to see its chunks.",
  search: "Search party, tag, owner or x z coordinates...",
  allParties: "All parties",
  allDimensions: "All dimensions",
  noParty: "No party",
  loading: "Loading claimed chunks...",
  empty: "No claimed chunk has been synced from the server yet.",
  noMatch: "No block matches the filters.",
  coordinateHint: "Showing the block that contains this position.",
  gridHint:
    "Click a chunk on the grid to open it on BlueMap, click a coordinate to copy a teleport command.",
  openMap: "Open on BlueMap",
  copied: "Teleport command copied",
} as const;

const ALL = "all";
const NO_PARTY = "none";
const NO_PARTY_SWATCH = "#9ca3af";

type Coordinates = { chunkX: number; chunkZ: number } | null;

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function blockCenterChunk(block: ClaimBlock): { x: number; z: number } {
  return {
    x: Math.round((block.minX + block.maxX) / 2),
    z: Math.round((block.minZ + block.maxZ) / 2),
  };
}

function blockCenterLabel(block: ClaimBlock): string {
  const center = blockCenterChunk(block);
  return `x ${chunkCenterToBlock(center.x)}, z ${chunkCenterToBlock(center.z)}`;
}

function blockSizeLabel(block: ClaimBlock): string {
  return `${block.maxX - block.minX + 1} × ${block.maxZ - block.minZ + 1}`;
}

function blockMapUrl(block: ClaimBlock): string {
  const center = blockCenterChunk(block);
  const span = Math.max(block.maxX - block.minX, block.maxZ - block.minZ) + 1;
  return chunkBluemapUrl(block.dimension, center.x, center.z, {
    distance: 300 + span * 40,
  });
}

function dimensionOrder(dimension: string): number {
  const index = DIMENSIONS.findIndex((known) => known.id === dimension);
  return index === -1 ? DIMENSIONS.length : index;
}

function partyFilterValue(block: ClaimBlock): string {
  return block.party ? String(block.party.id) : NO_PARTY;
}

export function ClaimsDialog({
  open,
  onOpenChange,
  serverId,
  initialPartyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  initialPartyId: number | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{COPY.title}</DialogTitle>
          <DialogDescription>{COPY.description}</DialogDescription>
        </DialogHeader>
        <ClaimsBrowser
          key={initialPartyId ?? ALL}
          serverId={serverId}
          initialPartyId={initialPartyId}
        />
      </DialogContent>
    </Dialog>
  );
}

function ClaimsBrowser({
  serverId,
  initialPartyId,
}: {
  serverId: number;
  initialPartyId: number | null;
}) {
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState<string>(ALL);
  const [partyId, setPartyId] = useState<string>(
    initialPartyId === null ? ALL : String(initialPartyId),
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const query = trpc.admin.parties.claimBlocks.useQuery({ serverId });
  const blocks = useMemo(() => query.data?.blocks ?? [], [query.data]);

  const dimensions = useMemo(
    () =>
      [...new Set(blocks.map((block) => block.dimension))].sort(
        (a, b) => dimensionOrder(a) - dimensionOrder(b) || a.localeCompare(b),
      ),
    [blocks],
  );
  const parties = useMemo(() => {
    const seen = new Map<string, string>();
    for (const block of blocks) {
      seen.set(partyFilterValue(block), block.party?.name ?? COPY.noParty);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [blocks]);

  const coordinates = parseCoordinateSearch(search);

  const shown = useMemo(
    () =>
      blocks.filter(
        (block) =>
          (dimension === ALL || block.dimension === dimension) &&
          (partyId === ALL || partyFilterValue(block) === partyId) &&
          blockMatches(block, search),
      ),
    [blocks, dimension, partyId, search],
  );
  const shownChunks = shown.reduce((sum, block) => sum + block.chunkCount, 0);

  if (query.isLoading) {
    return <Loading size="small" text={COPY.loading} />;
  }

  if (query.isError) {
    return (
      <p className="py-8 text-center text-destructive">
        Failed to load the claimed chunks: {query.error.message}
      </p>
    );
  }

  if (!query.data || blocks.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">{COPY.empty}</p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={COPY.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger className="min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{COPY.allParties}</SelectItem>
              {parties.map((party) => (
                <SelectItem key={party.value} value={party.value}>
                  {party.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChoiceField
            value={dimension}
            onChange={setDimension}
            options={[
              { value: ALL, label: COPY.allDimensions },
              ...dimensions.map((id) => ({
                value: id,
                label: formatDimension(id),
              })),
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {coordinates
              ? COPY.coordinateHint
              : `${formatCount(shown.length, "block")} · ${formatCount(shownChunks, "chunk")} · synced ${formatRelativeDateSafe(query.data.syncedAt)}`}
          </p>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto rounded-md border border-border bg-card">
        {shown.length === 0 ? (
          <p className="px-6 py-8 text-center text-muted-foreground">
            {COPY.noMatch}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((block) => {
              const key = blockKey(block);
              return (
                <ClaimBlockRow
                  key={key}
                  block={block}
                  expanded={expandedKey === key}
                  highlight={coordinates}
                  onToggle={() =>
                    setExpandedKey((prev) => (prev === key ? null : key))
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function ClaimBlockRow({
  block,
  expanded,
  highlight,
  onToggle,
}: {
  block: ClaimBlock;
  expanded: boolean;
  highlight: Coordinates;
  onToggle: () => void;
}) {
  const toast = useToastActions();
  const swatch = block.party
    ? `#${colorHex(block.party.color)}`
    : NO_PARTY_SWATCH;

  const copyTeleport = (x: number, z: number) => {
    navigator.clipboard.writeText(chunkTpCommand(block.dimension, x, z));
    toast.success(COPY.copied);
  };

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-3 pl-3 transition-colors hover:bg-muted/40",
          expanded && "bg-muted/30",
        )}
      >
        <div className="flex w-9 shrink-0 justify-center">
          <TeamTagPlate code={block.party?.tagCode ?? null} zoom={1} />
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pr-3 text-left"
        >
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-sm ring-1 ring-white/10 ring-inset"
            style={{ backgroundColor: swatch }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {block.party?.name ?? COPY.noParty}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDimension(block.dimension)} · around{" "}
              {blockCenterLabel(block)}
            </p>
          </div>
          <div className="flex flex-col items-end tabular-nums">
            <span className="text-sm">
              {formatCount(block.chunkCount, "chunk")}
            </span>
            <span className="text-xs text-muted-foreground">
              {blockSizeLabel(block)}
              {block.forceloadCount > 0 &&
                ` · ${block.forceloadCount} forceloaded`}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/10 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Chunks x {block.minX} to {block.maxX}, z {block.minZ} to{" "}
              {block.maxZ}. {COPY.gridHint}
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={blockMapUrl(block)} target="_blank" rel="noreferrer">
                <MapIcon className="size-4" />
                {COPY.openMap}
              </a>
            </Button>
          </div>
          <ClaimBlockGrid block={block} highlight={highlight} />
          <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {block.chunks.map((chunk) => {
              const highlighted =
                highlight?.chunkX === chunk.x && highlight?.chunkZ === chunk.z;
              return (
                <li key={`${chunk.x},${chunk.z}`}>
                  <button
                    type="button"
                    onClick={() => copyTeleport(chunk.x, chunk.z)}
                    title={`Copy /tp to chunk ${chunk.x}, ${chunk.z}`}
                    className={cn(
                      "cursor-pointer rounded border border-border bg-card px-1.5 py-0.5 font-mono text-xs tabular-nums transition-colors hover:border-primary/40",
                      chunk.forceloaded && "border-dashed",
                      highlighted && "border-primary bg-primary/10",
                    )}
                  >
                    {chunk.x}, {chunk.z}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}
