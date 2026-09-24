import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { SkinApiPromo } from "@/components/skin-api-promo";
import { TopRoleHero } from "./components/TopRoleHero";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { useChampionDock } from "./hooks/use-champion-dock";
import { figureSrc, HERO_ORDER } from "./top-roles";

const DOCK_DELAYS = [0.08, 0, 0.16];

const FLIGHT_LAYERS = [
  { layer: "fixed", className: "fixed inset-0" },
  { layer: "page", className: "absolute inset-0" },
] as const;

function ChampionFlight() {
  const [roles] = trpc.public.leaderboards.hero.useSuspenseQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  useChampionDock(HERO_ORDER, DOCK_DELAYS);

  return FLIGHT_LAYERS.map(({ layer, className }) => (
    <div
      key={layer}
      aria-hidden
      data-dock-layer={layer}
      className={cn("pointer-events-none z-20", className)}
    >
      {HERO_ORDER.map((key) => {
        const holder = roles.find((role) => role.roleKey === key)?.holder;
        return holder ? (
          <div
            key={key}
            data-dock-fly={key}
            className="invisible absolute top-0 left-0 origin-top-left will-change-transform"
          >
            <div
              data-dock-fly-shadow
              className="absolute bottom-0 left-1/2 h-[5%] w-2/3 rounded-[100%] bg-black opacity-0 blur-xl will-change-transform"
            />
            <img
              src={figureSrc(holder)}
              alt=""
              draggable={false}
              className="relative size-full max-w-none"
            />
          </div>
        ) : null;
      })}
    </div>
  ));
}

export function Leaderboards() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflowAnchor;
    root.style.overflowAnchor = "none";
    return () => {
      root.style.overflowAnchor = previous;
    };
  }, []);

  return (
    <div className="relative overflow-x-clip">
      <TopRoleHero />
      <div className="relative z-10 min-h-svh rounded-t-3xl border-t border-white/10 bg-background shadow-[0_-40px_120px_rgba(0,0,0,0.7)]">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
        />
        <LeaderboardTable />
        <SkinApiPromo />
      </div>
      <ChampionFlight />
    </div>
  );
}
