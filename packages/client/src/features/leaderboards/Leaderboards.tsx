import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { SkinApiPromo } from "@/components/skin-api-promo";
import { TopRoleHero } from "./components/TopRoleHero";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { useChampionDock } from "./hooks/use-champion-dock";
import { figureSrc, HERO_ORDER } from "./top-roles";

const DOCK_DELAYS = [0.08, 0, 0.16];

function ChampionFlight() {
  const [roles] = trpc.public.leaderboards.hero.useSuspenseQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  useChampionDock(HERO_ORDER, DOCK_DELAYS);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20">
      {HERO_ORDER.map((key) => {
        const holder = roles.find((role) => role.roleKey === key)?.holder;
        return holder ? (
          <img
            key={key}
            src={figureSrc(holder)}
            alt=""
            draggable={false}
            data-dock-fly={key}
            className="invisible absolute top-0 left-0 origin-top-left object-contain will-change-transform"
          />
        ) : null;
      })}
    </div>
  );
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
