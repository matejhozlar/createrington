import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Eye, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useCountdown } from "@/hooks/use-countdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CURSEFORGE_MODPACK_URL } from "@/lib/external-urls";
import { PackModsDialog } from "./PackModsDialog";

const HERO_IMAGE = "/assets/hero/dark-warehouse.webp";
const DUST_COUNT = 22;

const HEADING_CLASSES =
  "text-2xl md:text-3xl font-semibold text-foreground mb-5";
const PANEL_CLASSES =
  "relative rounded-[calc(var(--radius)+8px)] overflow-hidden bg-card";

const RUNNER_GLOW_STYLE: React.CSSProperties = {
  background:
    "conic-gradient(from 210deg, transparent 0deg, oklch(0.62 0.19 255 / .55) 40deg, transparent 90deg, transparent 260deg, oklch(0.82 0.19 84 / .55) 300deg, transparent 340deg)",
  filter: "blur(12px)",
  opacity: 0.7,
};

const BACKING_IMAGE_STYLE: React.CSSProperties = {
  filter: "grayscale(0.55) blur(2px) brightness(0.38)",
};

const PORTAL_HALO_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(ellipse 55% 75% at 78% 50%, oklch(0.4 0.15 255 / 0.45) 0%, transparent 55%)",
};

const VIGNETTE_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 70% 50%, transparent 30%, oklch(0.13 0.005 285 / .92) 80%)",
};

const BOTTOM_FADE_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(to bottom, transparent, oklch(0.17 0.0075 285.942 / 0.6) 70%, var(--background) 100%)",
};

function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatRotatedIn(ms: number): string {
  if (ms <= 0) return "just now";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function ActivePack() {
  const { user } = useAuth();

  const { data: activePack, isLoading } =
    trpc.user.structurePacks.current.useQuery(undefined, {
      enabled: !!user,
    });

  const { data: rotationInfo } = trpc.user.structurePacks.rotationInfo.useQuery(
    undefined,
    { enabled: !!user },
  );

  const countdown = useCountdown(rotationInfo?.nextRotationAt ?? null);
  const now = useMinuteTick();

  const [modsOpen, setModsOpen] = useState(false);

  if (isLoading) {
    return <ActivePackLoading />;
  }

  if (!activePack) {
    return <ActivePackEmpty />;
  }

  const modCount = activePack.mods.length;
  const rotatedInLabel = activePack.lastActivatedAt
    ? formatRotatedIn(now - new Date(activePack.lastActivatedAt).getTime())
    : "—";
  const rotatesOutLabel = countdown ?? "—";
  const dimensionLabel = `dim ${String(activePack.id).padStart(3, "0")}`;

  return (
    <>
      <h2 className={HEADING_CLASSES}>Active Pack</h2>

      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-0.5 rounded-[calc(var(--radius)+8px)] pointer-events-none z-0 active-pack-runner-rotate"
          style={RUNNER_GLOW_STYLE}
        />

        <div className={PANEL_CLASSES}>
          <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
            <img
              src={HERO_IMAGE}
              alt=""
              className="h-full w-full object-cover"
              style={BACKING_IMAGE_STYLE}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={PORTAL_HALO_STYLE}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={VIGNETTE_STYLE}
            />
          </div>

          <Dust count={DUST_COUNT} />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 p-8 md:p-10">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em]">
                <span className="font-semibold text-[oklch(0.62_0.19_255/0.9)]">
                  Active dimension
                </span>
                <span className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-[oklch(0.62_0.19_255/0.5)] to-transparent" />
                <span className="font-mono tabular-nums text-muted-foreground">
                  {dimensionLabel}
                </span>
              </div>

              <div>
                <h3 className="text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-[1.02]">
                  {activePack.name}
                </h3>
                {activePack.description && (
                  <p
                    className="mt-3 max-w-xl text-muted-foreground"
                    style={{ textWrap: "pretty" }}
                  >
                    {activePack.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                <Stat label="Mods loaded" value={String(modCount)} mono />
                <Stat label="Rotated in" value={rotatedInLabel} />
                <Stat
                  label="Rotates out"
                  value={rotatesOutLabel}
                  mono
                  emphasis
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button asChild className="group">
                  <a
                    href={CURSEFORGE_MODPACK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Join the server
                    <ArrowRight className="group-hover:translate-x-0.5" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setModsOpen(true)}
                  disabled={modCount === 0}
                  className="border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:text-foreground"
                >
                  <Eye />
                  Inspect
                </Button>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Rotation locked — vote to influence the next
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-5 justify-center">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Loaded mods
                  </div>
                  <span className="font-mono text-xs tabular-nums text-white/70">
                    {modCount} {modCount === 1 ? "item" : "items"}
                  </span>
                </div>
                {modCount === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    No mods loaded
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto pr-1 active-pack-scroll">
                    <ul className="space-y-1.5">
                      {activePack.mods.map((mod, i) => (
                        <li
                          key={mod.id}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground w-5 shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="size-1.5 rounded-full bg-[oklch(0.62_0.19_255/0.8)] shrink-0" />
                          <span className="truncate">{mod.modName}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-10"
            style={BOTTOM_FADE_STYLE}
          />
        </div>
      </div>

      <PackModsDialog
        open={modsOpen}
        onOpenChange={setModsOpen}
        packName={activePack.name}
        mods={activePack.mods}
      />
    </>
  );
}

interface StatProps {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}

function Stat({ label, value, mono, emphasis }: StatProps) {
  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-sm px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "mt-0.5 text-sm font-semibold tabular-nums truncate",
            mono && "font-mono",
            emphasis && "text-primary",
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

interface DustParticle {
  x0: string;
  x1: string;
  d: string;
  delay: string;
  o: number;
  size: number;
}

function Dust({ count }: { count: number }) {
  const [items] = useState<DustParticle[]>(() =>
    Array.from({ length: count }).map(() => {
      const x0 = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 20;
      return {
        x0: `${x0}%`,
        x1: `${x0 + drift}%`,
        d: `${14 + Math.random() * 16}s`,
        delay: `${-Math.random() * 20}s`,
        o: 0.25 + Math.random() * 0.55,
        size: Math.random() < 0.2 ? 3 : 2,
      };
    }),
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden z-0"
    >
      {items.map((p, i) => (
        <span
          key={i}
          className="packs-hero-dust"
          style={
            {
              "--x0": p.x0,
              "--x1": p.x1,
              "--d": p.d,
              "--delay": p.delay,
              "--o": p.o,
              width: p.size,
              height: p.size,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ActivePackLoading() {
  return (
    <>
      <h2 className={HEADING_CLASSES}>Active Pack</h2>
      <div className={PANEL_CLASSES}>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 p-8 md:p-10">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-3 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-80" />
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-3/4 max-w-md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-5 justify-center">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ActivePackEmpty() {
  return (
    <>
      <h2 className={HEADING_CLASSES}>Active Pack</h2>
      <div className="relative">
        <div className={PANEL_CLASSES}>
          <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
            <img
              src={HERO_IMAGE}
              alt=""
              className="h-full w-full object-cover opacity-60"
              style={BACKING_IMAGE_STYLE}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={VIGNETTE_STYLE}
            />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center gap-4 p-10 md:p-14">
            <Package className="size-10 text-muted-foreground" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[oklch(0.62_0.19_255/0.9)]">
              No active pack
            </div>
            <h3 className="text-3xl md:text-4xl font-bold tracking-[-0.02em]">
              Portal is cooling down
            </h3>
            <p className="max-w-md text-muted-foreground">
              The next rotation will load a new dimension.
            </p>
            <Button asChild>
              <a href="#pool">
                View pool
                <ArrowRight />
              </a>
            </Button>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-10"
            style={BOTTOM_FADE_STYLE}
          />
        </div>
      </div>
    </>
  );
}
