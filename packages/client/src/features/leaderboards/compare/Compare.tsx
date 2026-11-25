import { useEffect, useRef, useState, type CSSProperties } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/use-clipboard";
import { SkinApiPromo } from "@/components/skin-api-promo";
import { Button } from "@/components/ui/button";
import {
  HEADLINE_METRICS,
  SIDE_COLORS,
  stagePoses,
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
import "@/features/leaderboards/leaderboards.css";
import { useQuery } from "@tanstack/react-query";

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

function useContender(username: string | null, enabled: boolean) {
  return useQuery(
    trpc.public.leaderboards.contender.queryOptions(
      { username: username ?? "" },
      {
        enabled: !!username && enabled,
        staleTime: 60 * 1000,
        retry: false,
        placeholderData: (previous) => previous,
      },
    ),
  );
}

export function Compare() {
  const { copy } = useClipboard();
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

  const compareQuery = useQuery(
    trpc.public.leaderboards.compare.queryOptions(
      { first: first ?? "", second: second ?? "" },
      {
        enabled: both,
        staleTime: 60 * 1000,
        retry: false,
        placeholderData: (previous) => previous,
      },
    ),
  );
  const onStageAlone = !both || compareQuery.isError;
  const contenders = [
    useContender(first, onStageAlone),
    useContender(samePlayer ? null : second, onStageAlone),
  ];

  const players = compareQuery.isPlaceholderData
    ? undefined
    : compareQuery.data;
  const outgoing = compareQuery.isPlaceholderData
    ? compareQuery.data
    : undefined;
  const known: StageSide[] = [
    ...(compareQuery.data ?? []),
    ...contenders.flatMap((query) => (query.data ? [query.data] : [])),
  ];
  const stageSides = sides.map((username, index) => {
    if (!username || (samePlayer && index === 1)) return null;
    const name = username.toLowerCase();
    return (
      known.find((side) => side.minecraftUsername.toLowerCase() === name) ??
      outgoing?.[index] ??
      null
    );
  }) as [StageSide | null, StageSide | null];
  const seed = `${day}:${roll}`;
  const poses = stagePoses(
    [stageSides[0]?.minecraftUuid ?? "0", stageSides[1]?.minecraftUuid ?? "1"],
    seed,
  );
  const score = players ? scoreOf(players, now) : null;
  const sideErrors = sides.map(
    (username, index) =>
      !!username && onStageAlone && contenders[index].isError,
  );
  const missing = sides.filter(
    (_, index) =>
      sideErrors[index] && contenders[index].error?.data?.code === "NOT_FOUND",
  );
  const failed = compareQuery.isError || sideErrors.some(Boolean);
  const loading = sides.map(
    (username, index) => !!username && !stageSides[index] && !sideErrors[index],
  ) as [boolean, boolean];

  const retry = () => {
    if (both && compareQuery.isError) void compareQuery.refetch();
    contenders.forEach((query, index) => {
      if (sideErrors[index]) void query.refetch();
    });
  };

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
    if (action === "copy") void copy(window.location.href);
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
          {failed &&
            (missing.length > 0 ? (
              <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                {`Couldn't find ${missing.join(" or ")}. Pick someone else above.`}
              </p>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                <p>
                  {both
                    ? "Couldn't load this matchup."
                    : "Couldn't load this player."}
                </p>
                <Button variant="outline" size="sm" onClick={retry}>
                  Try again
                </Button>
              </div>
            ))}
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
