import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import type { StageSide } from "./CompareHero";

const SIDES = [
  { row: "flex-row", text: "text-(--left)" },
  { row: "flex-row-reverse", text: "text-(--right)" },
] as const;

export function MatchupBar({
  players,
  counts,
}: {
  players: [StageSide, StageSide];
  counts: [number, number] | null;
}) {
  return (
    <div className="sticky top-14 z-20 rounded-t-3xl border-b border-white/5 bg-background/85 backdrop-blur-md md:top-0">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 py-3 md:px-8">
        {players.map((player, index) => (
          <div
            key={player.minecraftUuid}
            className={cn(
              "flex min-w-0 items-center gap-2 md:gap-3",
              SIDES[index].row,
              index === 1 && "col-start-3",
            )}
          >
            <MinecraftAvatar
              username={player.minecraftUsername}
              uuid={player.minecraftUuid}
              size={28}
              className="shrink-0"
            />
            <span
              className={cn(
                "truncate text-sm font-bold md:text-base",
                SIDES[index].text,
              )}
            >
              {player.minecraftUsername}
            </span>
          </div>
        ))}
        <span className="col-start-2 row-start-1 text-sm font-extrabold tabular-nums md:text-base">
          {counts ? (
            <>
              <span className="text-(--left)">{counts[0]}</span>
              <span className="mx-1.5 text-white/25">–</span>
              <span className="text-(--right)">{counts[1]}</span>
            </>
          ) : (
            <span className="text-white/25">vs</span>
          )}
        </span>
      </div>
    </div>
  );
}
