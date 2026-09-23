import type { CSSProperties } from "react";
import { formatDate } from "@createrington/shared/format";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { mcHeadsBody } from "@/lib/external-urls";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { formatMetric, HERO_ORDER, topRoleStyle } from "../top-roles";

type TopRole = RouterOutput["public"]["leaderboards"]["hero"][number];

const SLOTS = [
  {
    figure: "h-[24vh] sm:h-[30vh] md:h-[38vh] lg:h-[42vh]",
    column: "col-start-1",
    enterDelay: "0.18s",
    transform:
      "translate3d(calc(var(--scroll-a) * -28px), calc(var(--scroll-b) * -160px), 0) scale(calc(1 - var(--scroll-a) * 0.04))",
    opacity: "calc(1 - var(--scroll-b) * 1.5)",
    name: "text-base sm:text-lg md:text-2xl",
  },
  {
    figure: "h-[31vh] sm:h-[38vh] md:h-[46vh] lg:h-[52vh]",
    column: "col-start-2",
    enterDelay: "0s",
    transform:
      "translate3d(0, calc(var(--scroll-b) * -80px), 0) scale(calc(1 + var(--scroll-a) * 0.06))",
    opacity: "calc(1 - var(--scroll-b) * 1.2)",
    name: "text-lg sm:text-xl md:text-3xl",
  },
  {
    figure: "h-[24vh] sm:h-[30vh] md:h-[38vh] lg:h-[42vh]",
    column: "col-start-3",
    enterDelay: "0.3s",
    transform:
      "translate3d(calc(var(--scroll-a) * 28px), calc(var(--scroll-b) * -160px), 0) scale(calc(1 - var(--scroll-a) * 0.04))",
    opacity: "calc(1 - var(--scroll-b) * 1.5)",
    name: "text-base sm:text-lg md:text-2xl",
  },
] as const;

function slotStyle(index: number, color: string): CSSProperties {
  const slot = SLOTS[index];
  return {
    "--role": color,
    "--enter-delay": slot.enterDelay,
    transform: slot.transform,
    opacity: slot.opacity,
  } as CSSProperties;
}

function HeroFigure({ role, index }: { role: TopRole; index: number }) {
  const slot = SLOTS[index];
  const style = topRoleStyle(role.roleKey);
  const holder = role.holder;
  const src = holder
    ? (holder.imageUrl ?? mcHeadsBody(holder.minecraftUuid))
    : null;

  return (
    <div
      className={cn(
        "row-start-1 flex justify-center will-change-transform",
        slot.column,
        index === 1 ? "z-20" : "z-10",
      )}
      style={slotStyle(index, style.color)}
    >
      <div className="lb-hero-enter relative flex items-end justify-center">
        <div
          aria-hidden
          className="absolute bottom-0.5 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/70 blur-md"
        />
        {src && holder ? (
          <div className="relative">
            <img
              src={src}
              alt={`${holder.minecraftUsername}, ${role.label}`}
              draggable={false}
              decoding="async"
              className={cn(
                "relative w-auto select-none drop-shadow-[0_18px_40px_rgba(0,0,0,0.65)]",
                slot.figure,
              )}
            />
            <img
              src={src}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute inset-x-0 top-full h-[38%] w-full -scale-y-100 object-cover object-bottom opacity-20 blur-[1px] [mask-image:linear-gradient(to_top,rgba(0,0,0,0.9),transparent)]"
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

function HeroCaption({ role, index }: { role: TopRole; index: number }) {
  const slot = SLOTS[index];
  const style = topRoleStyle(role.roleKey);
  const Icon = style.icon;
  const holder = role.holder;

  return (
    <figcaption
      className={cn(
        "lb-hero-caption relative z-30 row-start-2 flex min-w-0 flex-col items-center pt-4 text-center will-change-transform md:pt-6",
        slot.column,
      )}
      style={slotStyle(index, style.color)}
    >
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
          since {formatDate(holder.heldSince)}
        </span>
      )}
    </figcaption>
  );
}

function HeroSkeleton({ index }: { index: number }) {
  const slot = SLOTS[index];

  return (
    <>
      <div className={cn("row-start-1 flex justify-center", slot.column)}>
        <div
          className={cn(
            "aspect-[2/3] animate-pulse rounded-2xl bg-muted/40",
            slot.figure,
          )}
        />
      </div>
      <div
        className={cn(
          "row-start-2 flex flex-col items-center pt-6",
          slot.column,
        )}
      >
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted/40" />
        <div className="mt-3 h-6 w-32 animate-pulse rounded bg-muted/40" />
      </div>
    </>
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

  return (
    <section
      ref={ref}
      className="sticky top-14 z-0 h-[calc(100svh-3.5rem)] overflow-hidden bg-background md:top-0 md:h-svh"
    >
      <div aria-hidden className="absolute inset-0 render-bg-grid" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,rgba(255,255,255,0.07),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--background)_110%)]"
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

        <div className="grid flex-1 grid-cols-[1fr_1.15fr_1fr] content-end items-end gap-x-1 pb-[9vh] sm:gap-x-4 sm:pb-[7vh] md:gap-x-10 lg:gap-x-16">
          <div
            aria-hidden
            className="col-span-3 col-start-1 row-start-1 h-px w-full self-end bg-linear-to-r from-transparent via-white/15 to-transparent"
          />
          {ordered.map((role, index) => {
            const key = HERO_ORDER[index];
            if (heroQuery.isLoading)
              return <HeroSkeleton key={key} index={index} />;
            if (!role) return null;
            return <HeroFigure key={key} role={role} index={index} />;
          })}
          {ordered.map((role, index) => {
            if (heroQuery.isLoading || !role) return null;
            return (
              <HeroCaption key={HERO_ORDER[index]} role={role} index={index} />
            );
          })}
        </div>
      </div>
    </section>
  );
}
