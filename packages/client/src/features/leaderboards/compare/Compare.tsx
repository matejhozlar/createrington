import { useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowLeftRight, Dices, Link2 } from "lucide-react";
import type { KnownPose } from "createrington-skin-api";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  HEADLINE_METRICS,
  SIDE_COLORS,
  stagePose,
  type ComparedPlayer,
} from "./headToHead";
import { useCompareParams, type Side } from "./hooks/use-compare-params";
import {
  CompareStage,
  type StageScore,
  type StageSide,
} from "./components/CompareStage";
import { TugRow } from "./components/TugRow";
import { EveryStat } from "./components/EveryStat";

const ACTIONS = [
  { key: "reroll", label: "Reroll poses", icon: Dices },
  { key: "swap", label: "Swap sides", icon: ArrowLeftRight },
  { key: "copy", label: "Copy link", icon: Link2 },
] as const;

type ActionKey = (typeof ACTIONS)[number]["key"];

const REROLL_COOLDOWN_MS = 3000;

function scoreOf(
  players: [ComparedPlayer, ComparedPlayer],
  now: number,
): StageScore {
  let first = 0;
  let second = 0;
  for (const metric of HEADLINE_METRICS) {
    const a = metric.value(players[0], now);
    const b = metric.value(players[1], now);
    if (a > b) first++;
    if (b > a) second++;
  }
  if (first === second)
    return { text: `Dead even, ${first}–${second}`, side: null };
  const side: Side = first > second ? 0 : 1;
  return {
    text: `${players[side].minecraftUsername} leads ${Math.max(first, second)}–${Math.min(first, second)}`,
    side,
  };
}

function ScorePill({ score }: { score: StageScore }) {
  return (
    <div
      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-(--side)/40 bg-(--side)/10 px-4 text-sm font-semibold"
      style={
        {
          "--side": score.side === null ? "#a1a1aa" : SIDE_COLORS[score.side],
        } as CSSProperties
      }
    >
      <span className="size-2 shrink-0 rounded-full bg-(--side)" />
      <span className="truncate">{score.text}</span>
    </div>
  );
}

export function Compare() {
  const toast = useToastActions();
  const { sides, pick, swap } = useCompareParams();
  const [now] = useState(Date.now);
  const [day] = useState(() => new Date().toISOString().slice(0, 10));
  const [roll, setRoll] = useState(0);
  const lastRoll = useRef(-Infinity);
  const [first, second] = sides;
  const samePlayer =
    !!first && !!second && first.toLowerCase() === second.toLowerCase();
  const both = !!first && !!second && !samePlayer;
  const solo = both ? null : (first ?? second);

  const compareQuery = trpc.public.leaderboards.compare.useQuery(
    { first: first ?? "", second: second ?? "" },
    { enabled: both, staleTime: 60 * 1000, retry: false },
  );
  const soloQuery = trpc.public.leaderboards.contender.useQuery(
    { username: solo ?? "" },
    { enabled: !!solo, staleTime: 60 * 1000, retry: false },
  );

  const players = compareQuery.data;
  const stageSides = sides.map((username, index) => {
    if (!username || (samePlayer && index === 1)) return null;
    const compared = players?.[index];
    if (compared) return compared;
    const found = soloQuery.data;
    if (
      found &&
      found.minecraftUsername.toLowerCase() === username.toLowerCase()
    ) {
      return found;
    }
    return null;
  }) as [StageSide | null, StageSide | null];
  const seed = `${sides
    .map((side) => side?.toLowerCase() ?? "")
    .sort()
    .join("|")}:${day}:${roll}`;
  const poses = stageSides.map((side, index) =>
    stagePose(side?.minecraftUuid ?? String(index), seed),
  ) as [KnownPose, KnownPose];
  const score = players ? scoreOf(players, now) : null;
  const failed = compareQuery.isError || soloQuery.isError;

  const run = (key: ActionKey, at: number) => {
    if (key === "reroll") {
      if (at - lastRoll.current < REROLL_COOLDOWN_MS) return;
      lastRoll.current = at;
      setRoll((value) => value + 1);
    }
    if (key === "swap") swap();
    if (key === "copy") {
      void navigator.clipboard.writeText(window.location.href);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:space-y-7 md:px-8 md:py-10"
      style={
        { "--left": SIDE_COLORS[0], "--right": SIDE_COLORS[1] } as CSSProperties
      }
    >
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Link
            to="/leaderboards"
            className="inline-flex h-7 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to leaderboards
          </Link>
          <h1 className="text-2xl font-bold tracking-tight md:text-[34px]">
            Head to head
          </h1>
        </div>
        <div className="hidden gap-2 md:flex">
          {ACTIONS.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant="outline"
              onClick={(event) => run(key, event.timeStamp)}
              disabled={key !== "copy" && !both}
            >
              <Icon aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      </header>

      <CompareStage
        key={`${first}|${second}`}
        sides={stageSides}
        poses={poses}
        score={score}
        initialOpen={first && !second ? 1 : !first && second ? 0 : null}
        onPick={pick}
      />

      <div className="flex items-center gap-2 md:hidden">
        {score ? <ScorePill score={score} /> : <div className="flex-1" />}
        {ACTIONS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="outline"
            size="icon"
            className="size-11"
            onClick={(event) => run(key, event.timeStamp)}
            disabled={key !== "copy" && !both}
            aria-label={label}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>

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

      {both && !failed && (
        <>
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-bold md:text-[22px]">
                Headline stats
              </h2>
              <span className="hidden text-sm text-muted-foreground md:block">
                Bars split by share of the combined total
              </span>
            </div>
            <div
              className={cn(
                "rounded-xl border bg-card px-4 py-1 md:px-5",
                !players && "animate-pulse",
              )}
            >
              {players
                ? HEADLINE_METRICS.map((metric) => (
                    <TugRow
                      key={metric.label}
                      size="lg"
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
                  ))
                : HEADLINE_METRICS.map((metric) => (
                    <div key={metric.label} className="h-16" />
                  ))}
            </div>
          </section>

          {players && (
            <EveryStat
              first={players[0].minecraftUuid}
              second={players[1].minecraftUuid}
            />
          )}
        </>
      )}
    </div>
  );
}
