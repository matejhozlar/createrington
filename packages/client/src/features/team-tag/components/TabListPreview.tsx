import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PlateDesign } from "@createrington/shared/team-tag";
import { Skeleton } from "@/components/ui/skeleton";
import { PODIUM } from "@/features/team/data";
import { cn } from "@/lib/utils";
import {
  BACKDROPS,
  PLATE_PRESETS,
  RANKS,
  type Backdrop,
  type GuiScale,
} from "../presets";
import type { Bitmap, PlateAssets } from "../render/assets";
import { renderTabList, type TabRow } from "../render/tab-list";
import { useLoadedImage } from "../hooks/use-loaded-image";
import { useHeadBitmaps } from "../hooks/use-head-bitmaps";

type BoardParty = { tag: string; preset: number };

const RAIL: BoardParty = { tag: "RAIL", preset: 1 };
const BOSS_COLOR = 0xff0000;
const ADMIN_COLOR = 0xe36009;
const TEAM = [...PODIUM.left, ...PODIUM.center, ...PODIUM.right];

const TEAM_PARTIES: Record<string, BoardParty> = {
  Agent772: RAIL,
  The_BigShot: RAIL,
  Tetsuoken: { tag: "ZINC", preset: 3 },
  diablothe2nd: { tag: "BOOM", preset: 5 },
  Cailin05: { tag: "FARM", preset: 6 },
};

const TEAM_PINGS = [30, 54, 112, 78, 41, 96, 64];

const BOARD_PLAYERS: {
  name: string;
  skinUrl: string | null;
  nameColor: number;
  pingMs: number;
  party: BoardParty | null;
}[] = [
  ...TEAM.map((member, i) => ({
    name: member.username,
    skinUrl: member.skin,
    nameColor: member.tier === "owner" ? BOSS_COLOR : ADMIN_COLOR,
    pingMs: TEAM_PINGS[i % TEAM_PINGS.length],
    party: TEAM_PARTIES[member.username] ?? null,
  })),
  {
    name: "VoidVersa",
    skinUrl: null,
    nameColor: RANKS[RANKS.length - 1].color,
    pingMs: 88,
    party: { tag: "VOID", preset: 7 },
  },
];

const BOARD_SKIN_URLS = BOARD_PLAYERS.flatMap((player) =>
  player.skinUrl ? [player.skinUrl] : [],
);

function partyDesign(tag: string, preset: number): PlateDesign {
  return {
    style: "riveted",
    tag,
    plate: PLATE_PRESETS[preset].plate,
    letters: PLATE_PRESETS[preset].letters,
    plateFade: null,
    letterFade: null,
  };
}

export const TabListPreview = memo(function TabListPreview({
  design,
  assets,
  name,
  rank,
  head,
  guiScale,
  backdrop,
  logo,
  fill = false,
  className,
}: {
  design: PlateDesign;
  assets: PlateAssets | null;
  name: string;
  rank: number;
  head: Bitmap | undefined;
  guiScale: GuiScale;
  backdrop: Backdrop;
  logo: boolean;
  fill?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setFrame({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const backdropImage = useLoadedImage(
    BACKDROPS.find((option) => option.value === backdrop)!.src,
  );

  const boardHeads = useHeadBitmaps(BOARD_SKIN_URLS);

  const rows = useMemo<TabRow[] | null>(() => {
    if (!assets) return null;
    const others: TabRow[] = BOARD_PLAYERS.filter(
      (player) => player.name.toLowerCase() !== name.toLowerCase(),
    ).map((player) => ({
      name: player.name,
      nameColor: player.nameColor,
      head:
        (player.skinUrl ? boardHeads.get(player.skinUrl) : undefined) ??
        assets.steveHead,
      pingMs: player.pingMs,
      design: player.party
        ? partyDesign(player.party.tag, player.party.preset)
        : null,
    }));
    const you: TabRow = {
      name,
      nameColor: RANKS[rank].color,
      head: head ?? assets.steveHead,
      pingMs: 30,
      design,
    };
    return [
      you,
      ...others.sort((a, b) => {
        const x = a.name.toLowerCase();
        const y = b.name.toLowerCase();
        return x < y ? -1 : x > y ? 1 : 0;
      }),
    ];
  }, [assets, boardHeads, design, name, rank, head]);

  useEffect(() => {
    if (!canvasRef.current || !assets || !rows || !frame.width) return;
    renderTabList(canvasRef.current, {
      rows,
      guiScale: Number(guiScale),
      backdrop: backdropImage,
      assets,
      cssWidth: frame.width,
      cssHeight: fill ? frame.height : undefined,
      logo,
    });
  }, [assets, rows, guiScale, backdropImage, frame, fill, logo]);

  return (
    <div
      ref={frameRef}
      className={cn(
        "overflow-hidden border-t bg-black",
        fill && "flex items-center justify-center",
        className,
      )}
    >
      {assets ? (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Tab list with your ${design.tag} plate next to ${name}`}
          className="mx-auto block shrink-0 [image-rendering:pixelated]"
        />
      ) : (
        <Skeleton className="h-80 w-full rounded-none" />
      )}
    </div>
  );
});
