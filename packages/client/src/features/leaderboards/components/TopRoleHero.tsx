import { useState, type CSSProperties } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { usePreloadedImages } from "../hooks/use-preloaded-images";
import {
  figureSrc,
  formatMetric,
  heldFor,
  HERO_ORDER,
  topRoleStyle,
} from "../top-roles";

type TopRole = RouterOutput["public"]["leaderboards"]["hero"][number];

const HERO_BACKDROP = "/assets/hero/dark-warehouse.webp";

const SLOTS = [
  {
    figure: "h-[24vh] sm:h-[30vh] md:h-[38vh] lg:h-[42vh]",
    column: "col-start-1",
    enterDelay: "0.18s",
    captionTransform: "translate3d(calc(var(--scroll-a) * -24px), 0, 0)",
    name: "text-base sm:text-lg md:text-2xl",
  },
  {
    figure: "h-[31vh] sm:h-[38vh] md:h-[46vh] lg:h-[52vh]",
    column: "col-start-2",
    enterDelay: "0s",
    captionTransform: "translate3d(0, calc(var(--scroll-a) * 16px), 0)",
    name: "text-lg sm:text-xl md:text-3xl",
  },
  {
    figure: "h-[24vh] sm:h-[30vh] md:h-[38vh] lg:h-[42vh]",
    column: "col-start-3",
    enterDelay: "0.3s",
    captionTransform: "translate3d(calc(var(--scroll-a) * 24px), 0, 0)",
    name: "text-base sm:text-lg md:text-2xl",
  },
] as const;

const GROUNDING = {
  shadow: { opacity: "clamp(0, 1 - var(--flight, 0) * 4, 1)" },
  reflection: {
    opacity: "calc(0.2 * clamp(0, 1 - var(--flight, 0) * 4, 1))",
  },
} satisfies Record<string, CSSProperties>;

function slotStyle(index: number, color: string): CSSProperties {
  return {
    "--role": color,
    "--enter-delay": SLOTS[index].enterDelay,
  } as CSSProperties;
}

function captionStyle(index: number, color: string): CSSProperties {
  return {
    ...slotStyle(index, color),
    transform: SLOTS[index].captionTransform,
    opacity: "calc(1 - var(--scroll-a) * 1.6)",
  };
}

function HeroFigure({ role, index }: { role: TopRole; index: number }) {
  const slot = SLOTS[index];
  const style = topRoleStyle(role.roleKey);
  const holder = role.holder;
  const src = holder ? figureSrc(holder) : null;

  return (
    <div
      className={cn(
        "row-start-1 flex justify-center",
        slot.column,
        index === 1 ? "z-20" : "z-10",
      )}
      style={slotStyle(index, style.color)}
    >
      <div className="lb-hero-enter relative flex items-end justify-center">
        {src && holder ? (
          <div className="relative" data-dock-from={role.roleKey}>
            <div
              aria-hidden
              className="absolute bottom-0.5 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/70 blur-md"
              style={GROUNDING.shadow}
            />
            <img
              src={src}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute inset-x-0 top-full h-[38%] w-full -scale-y-100 object-cover object-bottom blur-[1px] [mask-image:linear-gradient(to_top,rgba(0,0,0,0.9),transparent)]"
              style={GROUNDING.reflection}
            />
            <img
              src={src}
              alt={`${holder.minecraftUsername}, ${role.label}`}
              data-dock-body
              draggable={false}
              decoding="async"
              className={cn("relative w-auto select-none", slot.figure)}
            />
          </div>
        ) : (
          <div
            className={cn(
              "relative flex aspect-[2/3] items-center justify-center rounded-2xl border border-dashed border-(--role)/40 bg-(--role)/5 text-xs font-semibold uppercase tracking-[0.25em] text-(--role)/70",
              slot.figure,
            )}
          >
            Unclaimed
          </div>
        )}
      </div>
    </div>
  );
}

function nextMidnightUtc(): string {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

function CrowningCountdown() {
  const [target] = useState(nextMidnightUtc);
  const countdown = useCountdown(target);
  return <>{countdown === "Ended" ? "now" : `in ${countdown}`}</>;
}

function HeroCaption({
  role,
  index,
  now,
}: {
  role: TopRole;
  index: number;
  now: number;
}) {
  const slot = SLOTS[index];
  const style = topRoleStyle(role.roleKey);
  const Icon = style.icon;
  const holder = role.holder;

  return (
    <figcaption
      className={cn(
        "relative z-30 row-start-2 min-w-0 pt-4 will-change-transform md:pt-6",
        slot.column,
      )}
      style={captionStyle(index, style.color)}
    >
      <div className="lb-hero-caption flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-(--role) sm:hidden">
          <Icon className="size-3" aria-hidden />
          {role.label}
        </span>
        <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-(--role)/40 bg-(--role)/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-(--role) shadow-[0_0_24px_-6px_var(--role)] sm:inline-flex md:text-xs">
          <Icon className="size-3.5" aria-hidden />
          {role.label}
        </span>
        <span
          className={cn(
            "mt-1 w-full truncate px-1 font-bold text-foreground drop-shadow-md sm:mt-2",
            slot.name,
          )}
        >
          {holder ? holder.minecraftUsername : "Nobody yet"}
        </span>
        <span className="text-xs font-semibold tabular-nums text-(--role) sm:text-sm md:text-base">
          {holder ? formatMetric(role.metric, holder.value) : style.tagline}
        </span>
        {holder && (
          <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block md:text-sm">
            {heldFor(holder.heldSince, now)}
          </span>
        )}
      </div>
    </figcaption>
  );
}

export function TopRoleHero() {
  const ref = useScrollProgress<HTMLElement>();
  const [now] = useState(Date.now);
  const [roles] = trpc.public.leaderboards.hero.useSuspenseQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const ordered = HERO_ORDER.map((key) =>
    roles.find((role) => role.roleKey === key),
  );
  usePreloadedImages(
    ordered.flatMap((role) => (role?.holder ? [figureSrc(role.holder)] : [])),
  );

  return (
    <section
      ref={ref}
      className="sticky top-14 z-0 h-[calc(100svh-3.5rem)] overflow-hidden bg-background md:top-0 md:h-svh"
    >
      <img
        src={HERO_BACKDROP}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover blur-[6px] brightness-[0.32] saturate-[0.7] will-change-transform"
        style={{ transform: "scale(calc(1 + var(--scroll-p) * 0.25))" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-background from-[8%] to-transparent to-[55%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-background to-transparent to-[35%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-background"
        style={{ opacity: "calc(var(--scroll-b) * 0.9)" }}
      />

      <div className="relative mx-auto flex h-full max-w-7xl flex-col px-5 md:px-8">
        <header
          className="pt-8 text-center md:pt-14"
          style={{
            transform: "translate3d(0, calc(var(--scroll-a) * -48px), 0)",
            opacity: "calc(1 - var(--scroll-a))",
          }}
        >
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Leaderboards
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-lg">
            Three titles, one holder each. The crowns are awarded again at
            midnight UTC, <CrowningCountdown />.
          </p>
        </header>

        <div className="grid flex-1 grid-cols-[1fr_1.15fr_1fr] content-end items-end gap-x-1 pb-[9vh] sm:gap-x-4 sm:pb-[7vh] md:gap-x-10 lg:gap-x-16">
          <div
            aria-hidden
            className="col-span-3 col-start-1 row-start-1 h-px w-full self-end bg-linear-to-r from-transparent via-white/15 to-transparent"
          />
          {ordered.map((role, index) =>
            role ? (
              <HeroFigure key={HERO_ORDER[index]} role={role} index={index} />
            ) : null,
          )}
          {ordered.map((role, index) =>
            role ? (
              <HeroCaption
                key={HERO_ORDER[index]}
                role={role}
                index={index}
                now={now}
              />
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}
