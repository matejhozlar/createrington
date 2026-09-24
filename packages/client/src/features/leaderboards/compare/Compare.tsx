import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { KnownPose } from "createrington-skin-api";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/hooks/use-toast";
import { SkinApiPromo } from "@/components/skin-api-promo";
import {
  HEADLINE_METRICS,
  SIDE_COLORS,
  stagePose,
  type ComparedPlayer,
} from "./headToHead";
import { useCompareParams, type Side } from "./hooks/use-compare-params";
import { useInView } from "./hooks/use-in-view";
import {
  CompareHero,
  type HeroAction,
  type StageScore,
  type StageSide,
} from "./components/CompareHero";
import { TugRow } from "./components/TugRow";
import { MatchupBar } from "./components/MatchupBar";
import { EveryStat } from "./components/EveryStat";

const REROLL_COOLDOWN_MS = 3000;

function scoreOf(
  players: [ComparedPlayer, ComparedPlayer],
  now: number,
): StageScore {
  const counts: [number, number] = [0, 0];
  for (const metric of HEADLINE_METRICS) {
    const a = metric.value(players[0], now);
    const b = metric.value(players[1], now);
    if (a > b) counts[0]++;
    if (b > a) counts[1]++;
  }
  const leader: Side | null =
    counts[0] === counts[1] ? null : counts[0] > counts[1] ? 0 : 1;
  return { counts, leader };
}

function HeadlineStats({
  players,
  now,
}: {
  players: [ComparedPlayer, ComparedPlayer] | undefined;
  now: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold md:text-[22px]">Headline stats</h2>
        <span className="hidden text-sm text-muted-foreground md:block">
          Bars split by share of the combined total
        </span>
      </div>
      <div
        ref={ref}
        className={cn(
          "rounded-xl border bg-card px-4 py-1 md:px-5",
          !players && "animate-pulse",
        )}
      >
        {HEADLINE_METRICS.map((metric) =>
          players ? (
            <TugRow
              key={metric.label}
              size="lg"
              settled={inView}
              label={metric.label}
              left={{
                value: metric.value(players[0], now),
                text: metric.display(players[0], now),
              }}
              right={{
                value: metric.value(players[1], now),
                text: metric.display(players[1], now),
              }}
            />
          ) : (
            <div key={metric.label} className="h-16" />
          ),
        )}
      </div>
    </section>
  );
}

export function Compare() {
  const toast = useToastActions();
  const { sides, pick, swap } = useCompareParams();
  const [now] = useState(Date.now);
  const [day] = useState(() => new Date().toISOString().slice(0, 10));
  const [roll, setRoll] = useState(0);
  const lastRoll = useRef(-Infinity);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rerollCooling, setRerollCooling] = useState(false);
  const [first, second] = sides;
  const samePlayer =
    !!first && !!second && first.toLowerCase() === second.toLowerCase();
  const both = !!first && !!second && !samePlayer;
  const solo = both ? null : (first ?? second);

  useEffect(
    () => () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    },
    [],
  );

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflowAnchor;
    root.style.overflowAnchor = "none";
    return () => {
      root.style.overflowAnchor = previous;
    };
  }, []);

  const compareQuery = trpc.public.leaderboards.compare.useQuery(
    { first: first ?? "", second: second ?? "" },
    {
      enabled: both,
      staleTime: 60 * 1000,
      retry: false,
      placeholderData: (previous) => previous,
    },
  );
  const soloQuery = trpc.public.leaderboards.contender.useQuery(
    { username: solo ?? "" },
    {
      enabled: !!solo,
      staleTime: 60 * 1000,
      retry: false,
      placeholderData: (previous) => previous,
    },
  );

  const players = compareQuery.isPlaceholderData
    ? undefined
    : compareQuery.data;
  const known: StageSide[] = [
    ...(compareQuery.data ?? []),
    ...(soloQuery.data ? [soloQuery.data] : []),
  ];
  const stageSides = sides.map((username, index) => {
    if (!username || (samePlayer && index === 1)) return null;
    const name = username.toLowerCase();
    return (
      known.find((side) => side.minecraftUsername.toLowerCase() === name) ??
      null
    );
  }) as [StageSide | null, StageSide | null];
  const seed = `${day}:${roll}`;
  const poses = stageSides.map((side, index) =>
    stagePose(side?.minecraftUuid ?? String(index), seed),
  ) as [KnownPose, KnownPose];
  const score = players ? scoreOf(players, now) : null;
  const failed = compareQuery.isError || soloQuery.isError;
  const loading = sides.map(
    (username, index) => !!username && !stageSides[index] && !failed,
  ) as [boolean, boolean];

  const run = (action: HeroAction, at: number) => {
    if (action === "reroll") {
      if (at - lastRoll.current < REROLL_COOLDOWN_MS) return;
      lastRoll.current = at;
      setRoll((value) => value + 1);
      setRerollCooling(true);
      cooldownTimer.current = setTimeout(
        () => setRerollCooling(false),
        REROLL_COOLDOWN_MS,
      );
    }
    if (action === "swap") swap();
    if (action === "copy") {
      void navigator.clipboard.writeText(window.location.href);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <div
      className="relative overflow-x-clip"
      style={
        { "--left": SIDE_COLORS[0], "--right": SIDE_COLORS[1] } as CSSProperties
      }
    >
      <CompareHero
        sides={stageSides}
        poses={poses}
        score={score}
        initialOpen={first && !second ? 1 : !first && second ? 0 : null}
        loading={loading}
        actionsEnabled={both}
        rerollCooling={rerollCooling}
        onPick={pick}
        onAction={run}
      />
      <div className="relative z-10 rounded-t-3xl border-t border-white/10 bg-background shadow-[0_-40px_120px_rgba(0,0,0,0.7)]">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-30 h-px bg-linear-to-r from-(--left)/50 via-white/10 to-(--right)/50"
        />
        {both && stageSides[0] && stageSides[1] && (
          <MatchupBar
            players={[stageSides[0], stageSides[1]]}
            counts={score?.counts ?? null}
          />
        )}
        <div className="mx-auto max-w-5xl space-y-10 px-5 py-12 md:px-8 md:py-16">
          {failed && (
            <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Couldn't find that player. Pick someone else above.
            </p>
          )}
          {samePlayer && (
            <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              That's the same player twice. Pick a challenger above.
            </p>
          )}
          {!both && !failed && !samePlayer && (
            <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Pick two players above to see how they stack up.
            </p>
          )}
          {both && !failed && (
            <>
              <HeadlineStats players={players} now={now} />
              {players && (
                <EveryStat
                  first={players[0].minecraftUuid}
                  second={players[1].minecraftUuid}
                />
              )}
            </>
          )}
        </div>
        <SkinApiPromo />
      </div>
    </div>
  );
}
