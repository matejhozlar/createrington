import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PlateDesign } from "@createrington/shared/team-prefix";
import { ChoiceField } from "@/components/choice-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BACKDROPS,
  GUI_SCALES,
  PLATE_PRESETS,
  RANKS,
  type Backdrop,
  type GuiScale,
} from "../presets";
import { PODIUM } from "@/features/team/data";
import { mcHeadsSkin } from "@/lib/external-urls";
import type { Bitmap, PlateAssets } from "../render/assets";
import { renderTabList, type TabRow } from "../render/tab-list";
import { useLoadedImage } from "../hooks/use-loaded-image";
import { useSkinBitmaps } from "../hooks/use-skin-bitmaps";

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
  skinUrl: string;
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
    skinUrl: mcHeadsSkin("VoidVersa"),
    nameColor: RANKS[RANKS.length - 1].color,
    pingMs: 88,
    party: { tag: "VOID", preset: 7 },
  },
];

const BOARD_SKIN_URLS = BOARD_PLAYERS.map((player) => player.skinUrl);

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
  skin,
  guiScale,
  backdrop,
  onRankChange,
  onGuiScaleChange,
  onBackdropChange,
}: {
  design: PlateDesign;
  assets: PlateAssets | null;
  name: string;
  rank: number;
  skin: Bitmap | undefined;
  guiScale: GuiScale;
  backdrop: Backdrop;
  onRankChange: (rank: number) => void;
  onGuiScaleChange: (scale: GuiScale) => void;
  onBackdropChange: (backdrop: Backdrop) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) =>
      setFrameWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const backdropImage = useLoadedImage(
    BACKDROPS.find((option) => option.value === backdrop)!.src,
  );

  const boardSkins = useSkinBitmaps(BOARD_SKIN_URLS);

  const rows = useMemo<TabRow[] | null>(() => {
    if (!assets) return null;
    const others: TabRow[] = BOARD_PLAYERS.filter(
      (player) => player.name.toLowerCase() !== name.toLowerCase(),
    ).map((player) => ({
      name: player.name,
      nameColor: player.nameColor,
      skin: boardSkins.get(player.skinUrl) ?? assets.steve,
      pingMs: player.pingMs,
      design: player.party
        ? partyDesign(player.party.tag, player.party.preset)
        : null,
    }));
    const you: TabRow = {
      name,
      nameColor: RANKS[rank].color,
      skin: skin ?? assets.steve,
      pingMs: 30,
      design,
    };
    return [...others, you].sort((a, b) => {
      const x = a.name.toLowerCase();
      const y = b.name.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }, [assets, boardSkins, design, name, rank, skin]);

  useEffect(() => {
    if (!canvasRef.current || !assets || !rows) return;
    renderTabList(canvasRef.current, {
      rows,
      guiScale: Number(guiScale),
      backdrop: backdropImage,
      assets,
      minCssWidth: frameWidth,
    });
  }, [assets, rows, guiScale, backdropImage, frameWidth]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !assets) return;
    frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2;
  }, [assets, guiScale, frameWidth]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">In the tab list</CardTitle>
        <CardDescription>
          Drawn the way the game draws it, at the real size for your screen,
          next to the Createrington team. Their plates here are only examples.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              GUI scale
            </span>
            <ChoiceField
              value={guiScale}
              options={GUI_SCALES.map((value) => ({ value, label: value }))}
              onChange={onGuiScaleChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Behind
            </span>
            <ChoiceField
              value={backdrop}
              options={BACKDROPS}
              onChange={onBackdropChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your rank
            </span>
            <Select
              value={String(rank)}
              onValueChange={(value) => onRankChange(Number(value))}
            >
              <SelectTrigger className="w-52" aria-label="Your rank">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANKS.map((option, i) => (
                  <SelectItem key={option.label} value={String(i)}>
                    <img
                      src={option.icon}
                      alt=""
                      className="h-4 w-[21px] shrink-0 object-contain [image-rendering:pixelated]"
                    />
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div
          ref={frameRef}
          className="overflow-x-auto overflow-y-hidden rounded-lg border bg-black"
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
      </CardContent>
    </Card>
  );
});
