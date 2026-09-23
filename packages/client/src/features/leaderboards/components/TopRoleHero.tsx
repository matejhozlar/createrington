import type { CSSProperties } from "react";
import { formatDate } from "@createrington/shared/format";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { mcHeadsBody } from "@/lib/external-urls";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { formatMetric, HERO_ORDER, topRoleStyle } from "../top-roles";

type TopRole = RouterOutput["public"]["leaderboards"]["hero"][number];

const FIGURE_LAYOUT = {
  side: {
    figure: "h-[24vh] sm:h-[30vh] md:h-[38vh] lg:h-[42vh]",
    placeholder: "h-[24vh] sm:h-[30vh] md:h-[38vh] lg:h-[42vh]",
    lift: -140,
    fade: 1.4,
    scale: 0.08,
  },
  center: {
    figure: "h-[31vh] sm:h-[38vh] md:h-[46vh] lg:h-[52vh]",
    placeholder: "h-[31vh] sm:h-[38vh] md:h-[46vh] lg:h-[52vh]",
    lift: -60,
    fade: 1.1,
    scale: 0.04,
  },
} as const;

function figureMotion(
  layout: (typeof FIGURE_LAYOUT)[keyof typeof FIGURE_LAYOUT],
) {
  return {
    transform: `translate3d(0, calc(var(--scroll-p) * ${layout.lift}px), 0) scale(calc(1 - var(--scroll-p) * ${layout.scale}))`,
    opacity: `calc(1 - var(--scroll-p) * ${layout.fade})`,
  } satisfies CSSProperties;
}

function HeroFigure({ role, center }: { role: TopRole; center: boolean }) {
  const style = topRoleStyle(role.roleKey);
  const layout = center ? FIGURE_LAYOUT.center : FIGURE_LAYOUT.side;
  const Icon = style.icon;
  const holder = role.holder;

  return (
    <figure
      className={cn(
        "relative flex min-w-0 flex-col items-center will-change-transform",
        center ? "z-20 -mx-2 sm:-mx-1 md:mx-0" : "z-10",
      )}
      style={
        { "--role": style.color, ...figureMotion(layout) } as CSSProperties
      }
    >
      <div className="relative flex items-end justify-center">
        <div
          aria-hidden
          className="absolute bottom-0 left-1/2 h-24 w-40 -translate-x-1/2 rounded-[100%] bg-(--role) opacity-35 blur-3xl md:h-32 md:w-64"
        />
        <div
          aria-hidden
          className="absolute bottom-1 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/70 blur-md"
        />
        {holder ? (
          <img
            src={holder.imageUrl ?? mcHeadsBody(holder.minecraftUuid)}
            alt={`${holder.minecraftUsername}, ${role.label}`}
            draggable={false}
            decoding="async"
            className={cn(
              "relative w-auto select-none drop-shadow-[0_18px_40px_rgba(0,0,0,0.65)]",
              layout.figure,
            )}
          />
        ) : (
          <div
            className={cn(
              "relative flex aspect-[2/3] items-center justify-center rounded-2xl border border-dashed border-(--role)/40 bg-(--role)/5 text-xs font-semibold uppercase tracking-[0.25em] text-(--role)/70",
              layout.placeholder,
            )}
          >
            Unclaimed
          </div>
        )}
      </div>

      <figcaption className="mt-3 flex w-full flex-col items-center text-center md:mt-6">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-(--role) sm:hidden">
          <Icon className="size-3" aria-hidden />
          {role.label}
        </span>
        <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-(--role)/40 bg-(--role)/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-(--role) sm:inline-flex md:text-xs">
          <Icon className="size-3.5" aria-hidden />
          {role.label}
        </span>
        <span
          className={cn(
            "mt-1 w-full truncate px-1 font-bold text-foreground drop-shadow-md sm:mt-2",
            center
              ? "text-lg sm:text-xl md:text-3xl"
              : "text-base sm:text-lg md:text-2xl",
          )}
        >
          {holder ? holder.minecraftUsername : "Nobody yet"}
        </span>
        <span className="text-xs font-semibold tabular-nums text-(--role) sm:text-sm md:text-base">
          {holder ? formatMetric(role.metric, holder.value) : style.tagline}
        </span>
        {holder && (
          <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block md:text-sm">
            since {formatDate(holder.heldSince)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function HeroFigureSkeleton({ center }: { center: boolean }) {
  const layout = center ? FIGURE_LAYOUT.center : FIGURE_LAYOUT.side;

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "aspect-[2/3] animate-pulse rounded-2xl bg-muted/40",
          layout.placeholder,
        )}
      />
      <div className="mt-6 h-5 w-24 animate-pulse rounded-full bg-muted/40" />
      <div className="mt-3 h-6 w-32 animate-pulse rounded bg-muted/40" />
    </div>
  );
}

export function TopRoleHero() {
  const ref = useScrollProgress<HTMLElement>();
  const heroQuery = trpc.public.leaderboards.hero.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const roles = heroQuery.data ?? [];
  const ordered = HERO_ORDER.map((key) =>
    roles.find((role) => role.roleKey === key),
  );
  const glowStyle = HERO_ORDER.map((key) => topRoleStyle(key).color);

  return (
    <section
      ref={ref}
      className="sticky top-14 z-0 h-[calc(100svh-3.5rem)] overflow-hidden bg-background md:top-0 md:h-svh"
      style={{ "--scroll-p": 0 } as CSSProperties}
    >
      <div aria-hidden className="absolute inset-0 render-bg-grid" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 opacity-40 blur-[120px]"
        style={{
          background: `radial-gradient(40% 60% at 18% 100%, ${glowStyle[0]} 0%, transparent 70%), radial-gradient(45% 70% at 50% 100%, ${glowStyle[1]} 0%, transparent 70%), radial-gradient(40% 60% at 82% 100%, ${glowStyle[2]} 0%, transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-background to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-background"
        style={{ opacity: "calc(var(--scroll-p) * 0.9)" }}
      />

      <div className="relative mx-auto flex h-full max-w-7xl flex-col px-5 md:px-8">
        <header
          className="pt-8 text-center md:pt-14"
          style={{
            transform: "translate3d(0, calc(var(--scroll-p) * -60px), 0)",
            opacity: "calc(1 - var(--scroll-p) * 1.8)",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary md:text-sm">
            Hall of Fame
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Leaderboards
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-lg">
            Three titles, one holder each. Every night at midnight UTC the
            crowns change hands.
          </p>
        </header>

        <div className="flex flex-1 items-end justify-center gap-1 pb-[9vh] sm:gap-4 sm:pb-[6vh] md:gap-10 lg:gap-16">
          {ordered.map((role, index) => {
            const center = index === 1;
            const key = HERO_ORDER[index];
            if (heroQuery.isLoading) {
              return <HeroFigureSkeleton key={key} center={center} />;
            }
            if (!role) return null;
            return <HeroFigure key={key} role={role} center={center} />;
          })}
        </div>
      </div>
    </section>
  );
}
