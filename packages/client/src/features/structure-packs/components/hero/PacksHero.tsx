import type { RefObject } from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { ArrowRight, Clock, Package, Rocket, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCountdown } from "@/hooks/use-countdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FloatingDust } from "../FloatingDust";
import { PortalFrame } from "./PortalFrame";

const HERO_IMAGE = "/assets/hero/dark-warehouse.webp";
const PARTICLE_COUNT = 30;
const LEADING_PEEK_LIMIT = 5;

interface PacksHeroProps {
  activePackRef: RefObject<HTMLElement | null>;
  onEnterPortal: (getRect: () => DOMRect) => void;
  portalHidden: boolean;
}

export interface PacksHeroHandle {
  openPortal: () => void;
}

export const PacksHero = forwardRef<PacksHeroHandle, PacksHeroProps>(
  function PacksHero(
    { activePackRef, onEnterPortal, portalHidden },
    externalRef,
  ) {
    const desktopPortalRef = useRef<HTMLDivElement | null>(null);
    const mobileAmbientRef = useRef<HTMLDivElement | null>(null);
    const idleGlow = !portalHidden;

    const { data: pool, isLoading: poolLoading } =
      trpc.public.structurePacks.pool.useQuery();

    const { data: rotationInfo } =
      trpc.public.structurePacks.rotationInfo.useQuery();

    const countdown = useCountdown(rotationInfo?.nextRotationAt ?? null);

    const totalBoosts =
      pool?.reduce((sum, entry) => sum + entry.boostUnits, 0) ?? 0;

    const scrollTo = (ref: RefObject<HTMLElement | null>) => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const enterPortal = () => {
      const desktopEl = desktopPortalRef.current;
      if (desktopEl && desktopEl.offsetWidth > 0) {
        desktopEl.classList.add("packs-hero-portal-frozen");
      }
      onEnterPortal(() => {
        const desktop = desktopPortalRef.current;
        if (desktop && desktop.offsetWidth > 0) {
          return desktop.getBoundingClientRect();
        }
        const mobile = mobileAmbientRef.current;
        if (mobile && mobile.offsetWidth > 0) {
          return mobile.getBoundingClientRect();
        }
        const w = 240;
        const h = 300;
        return new DOMRect(
          (window.innerWidth - w) / 2,
          (window.innerHeight - h) / 2,
          w,
          h,
        );
      });
    };

    useImperativeHandle(externalRef, () => ({ openPortal: enterPortal }));

    useEffect(() => {
      if (portalHidden) return;
      const el = desktopPortalRef.current;
      if (!el) return;
      el.classList.remove("packs-hero-portal-frozen");
      el.classList.add("packs-hero-portal-lighting-up");
      const lightingUpId = window.setTimeout(() => {
        el.classList.remove("packs-hero-portal-lighting-up");
      }, 550);
      return () => {
        window.clearTimeout(lightingUpId);
      };
    }, [portalHidden]);

    return (
      <section className="relative h-[calc(100svh-var(--mobile-nav-height))] w-full overflow-hidden text-foreground">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: "grayscale(0.5) blur(2px) brightness(0.35)" }}
          />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              "radial-gradient(ellipse 80% 95% at 50% 55%, oklch(0.5 0.22 260 / 0.38) 0%, oklch(0.4 0.18 258 / 0.22) 28%, oklch(0.3 0.12 255 / 0.1) 60%, transparent 88%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background: [
              "linear-gradient(to bottom, oklch(0.45 0.2 260 / 0.14) 0%, transparent 28%)",
              "linear-gradient(to top, oklch(0.45 0.2 260 / 0.14) 0%, transparent 28%)",
              "linear-gradient(to right, oklch(0.45 0.18 258 / 0.09) 0%, transparent 18%)",
              "linear-gradient(to left, oklch(0.45 0.18 258 / 0.09) 0%, transparent 18%)",
            ].join(", "),
            mixBlendMode: "screen",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              "radial-gradient(ellipse 45% 40% at 50% 55%, oklch(0.62 0.2 258 / 0.16) 0%, transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 72% 55%, oklch(0.4 0.15 255 / 0.38) 0%, transparent 55%)",
          }}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center lg:hidden"
        >
          <div
            ref={mobileAmbientRef}
            className="opacity-70 [filter:blur(13px)_saturate(0.8)_brightness(0.75)]"
            style={{
              maskImage:
                "radial-gradient(ellipse 95% 90% at center, black 70%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 95% 90% at center, black 70%, transparent 100%)",
            }}
          >
            <PortalFrame blockSize={120} variant="ambient" />
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, oklch(0.13 0.005 285 / 0.8) 100%)",
          }}
        />

        <FloatingDust count={PARTICLE_COUNT} unit="vw" />

        <div className="packs-hero-grain" aria-hidden />

        <div className="relative mx-auto grid h-full w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 md:px-10 lg:grid-cols-[1.1fr_1fr]">
          <div
            className={cn(
              "transition-opacity duration-500 ease-out lg:opacity-100",
              portalHidden ? "opacity-0" : "opacity-100",
            )}
          >
            <HeroCopy
              countdown={countdown}
              poolCount={pool?.length ?? 0}
              totalBoosts={totalBoosts}
              poolLoading={poolLoading}
              onPrimary={enterPortal}
              onSecondary={() => scrollTo(activePackRef)}
            />
          </div>

          <div className="relative hidden flex-col items-center justify-center gap-6 lg:flex">
            <div
              className={cn(
                "transition-opacity",
                portalHidden ? "opacity-0" : "opacity-100",
              )}
              style={{ transitionDuration: portalHidden ? "120ms" : "0ms" }}
            >
              <PortalFrame
                ref={desktopPortalRef}
                blockSize={72}
                className="packs-hero-float-y"
                interactive
                onActivate={enterPortal}
                ariaLabel="Enter portal to vote for next rotation"
                idleGlow={idleGlow}
              />
            </div>
            <div className="w-full max-w-[360px]">
              <LeadingPeek pool={pool} isLoading={poolLoading} />
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, oklch(0.17 0.0075 285.942 / 0.5) 60%, var(--background) 100%)",
          }}
        />
      </section>
    );
  },
);

interface HeroCopyProps {
  countdown: string | null;
  poolCount: number;
  totalBoosts: number;
  poolLoading: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}

function HeroCopy({
  countdown,
  poolCount,
  totalBoosts,
  poolLoading,
  onPrimary,
  onSecondary,
}: HeroCopyProps) {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-6 text-left">
      <h1 className="text-5xl font-bold leading-[1.02] tracking-[-0.02em] md:text-6xl lg:text-7xl">
        Shape the
        <br />
        <span className="text-primary">next world</span>.
      </h1>

      <p
        className="max-w-xl text-base text-muted-foreground md:text-lg"
        style={{ textWrap: "pretty" }}
      >
        Mining dimensions rotate on a schedule. Spend in-game currency to boost
        the themed pack you want next — weighted voting decides what appears
        through the portal.
      </p>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          icon={Clock}
          label="Next rotation"
          value={countdown ?? "—"}
          mono
        />
        <Stat
          icon={Package}
          label="Packs in pool"
          value={poolLoading ? null : `${poolCount} themed`}
        />
        <Stat
          icon={Rocket}
          label="Boosts spent"
          value={poolLoading ? null : `${totalBoosts} this cycle`}
          mono
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Button size="lg" className="group text-base" onClick={onPrimary}>
          <Rocket />
          Vote &amp; boost a pack
          <ArrowRight className="group-hover:translate-x-0.5" />
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="text-base"
          onClick={onSecondary}
        >
          View active pack
        </Button>

        <span className="ml-1 text-xs text-muted-foreground">
          Boosts reset each rotation
        </span>
      </div>
    </div>
  );
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  mono?: boolean;
}

function Stat({ icon: Icon, label, value, mono }: StatProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
      <div className="grid size-8 place-items-center rounded-lg bg-white/5 text-white/70">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        {value === null ? (
          <Skeleton className="mt-0.5 h-4 w-20" />
        ) : (
          <div
            className={cn(
              "truncate text-sm font-semibold tabular-nums",
              mono && "font-mono",
            )}
          >
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

interface PoolEntry {
  pack: { id: number; name: string };
  weight: number;
  boostUnits: number;
}

interface LeadingPeekProps {
  pool: PoolEntry[] | undefined;
  isLoading: boolean;
}

function LeadingPeek({ pool, isLoading }: LeadingPeekProps) {
  const totalWeight = pool?.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;

  const sorted = useMemo(() => {
    if (!pool) return [];
    return [...pool]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, LEADING_PEEK_LIMIT);
  }, [pool]);

  const leader = sorted[0];
  const leaderPct =
    leader && totalWeight > 0
      ? Math.round((leader.weight / totalWeight) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.06] to-transparent p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">
            Leading the vote
          </span>
        </div>
        <TrendingUp className="size-3.5 text-primary" />
      </div>

      {isLoading || !leader ? (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-7 w-12" />
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="text-2xl font-bold">{leader.pack.name}</div>
            <div className="font-mono text-2xl font-bold tabular-nums text-primary">
              {leaderPct}%
            </div>
          </div>
          <div className="space-y-1.5">
            {sorted.map((entry, idx) => {
              const pct =
                totalWeight > 0
                  ? Math.round((entry.weight / totalWeight) * 100)
                  : 0;
              const leading = idx === 0;
              return (
                <div
                  key={entry.pack.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <div className="w-24 truncate text-muted-foreground">
                    {entry.pack.name}
                  </div>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: leading
                          ? "var(--primary)"
                          : "oklch(0.62 0.12 255)",
                        boxShadow: leading
                          ? "0 0 10px var(--primary)"
                          : "0 0 6px oklch(0.62 0.19 255 / 0.5)",
                      }}
                    />
                  </div>
                  <div className="w-8 text-right font-mono tabular-nums text-muted-foreground">
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <a
        href="https://www.curseforge.com/minecraft/mc-mods/parallel-worlds-by-agent772"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block border-t border-white/10 pt-2.5 text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
      >
        Parallel Worlds by{" "}
        <span className="font-semibold text-primary/90">Agent772</span>
      </a>
    </div>
  );
}
