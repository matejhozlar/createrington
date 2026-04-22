import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Blocks, Info, Package, Rocket, TrendingUp, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";
import { BoostDialog } from "../BoostDialog";
import { PackModsDialog } from "../PackModsDialog";
import { PortalFrame } from "./PortalFrame";

interface PoolMod {
  id: number;
  modName: string;
  modUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string;
}

interface PoolPack {
  id: number;
  name: string;
  description: string | null;
  mods: PoolMod[];
}

interface PoolEntry {
  pack: PoolPack;
  weight: number;
  boostUnits: number;
}

interface PortalZoomOverlayProps {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onReblurring?: () => void;
  getSourceRect: (() => DOMRect) | null;
  pool: PoolEntry[] | undefined;
  isLoading: boolean;
  totalWeight: number;
  myBoostMap: Map<number, number>;
  boostUnitPrice: number;
  nextRotationAt: string | null;
  cycleNumber: number | null;
}

const PORTAL_BLOCK_SIZE = 72;
const PORTAL_COLS = 4;
const PORTAL_ROWS = 5;
const PORTAL_NATIVE_W = PORTAL_COLS * PORTAL_BLOCK_SIZE;
const PORTAL_NATIVE_H = PORTAL_ROWS * PORTAL_BLOCK_SIZE;
const INTERIOR_OFFSET = PORTAL_BLOCK_SIZE;
const INTERIOR_W = 2 * PORTAL_BLOCK_SIZE;
const INTERIOR_H = 3 * PORTAL_BLOCK_SIZE;

const SCALE_MS = 1200;
const CARDS_FADE_MS = 500;
const HERO_FADE_MS = 500;
const RAMP_MS = 500;

type Phase =
  | "closed"
  | "entering"
  | "unblurring"
  | "scaling"
  | "open"
  | "closing"
  | "shrinking"
  | "reblurring";

export function PortalZoomOverlay({
  open,
  onClose,
  onClosed,
  onReblurring,
  getSourceRect,
  pool,
  isLoading,
  totalWeight,
  myBoostMap,
  boostUnitPrice,
  nextRotationAt,
  cycleNumber,
}: PortalZoomOverlayProps) {
  const [phase, setPhase] = useState<Phase>("closed");
  const onClosedRef = useRef(onClosed);
  const onReblurringRef = useRef(onReblurring);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);
  useEffect(() => {
    onReblurringRef.current = onReblurring;
  }, [onReblurring]);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 0,
    h: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  const sourceRect = useMemo(() => {
    void viewport;
    return getSourceRect?.() ?? null;
  }, [getSourceRect, viewport]);

  useEffect(() => {
    if (open && phase === "closed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("entering");
    } else if (!open && (phase === "open" || phase === "scaling")) {
      setPhase("closing");
    }
  }, [open, phase]);

  useEffect(() => {
    const ambientMode = window.innerWidth < 1024;
    const enterMs = ambientMode ? HERO_FADE_MS : 16;
    const rampMs = ambientMode ? RAMP_MS : 16;

    if (phase === "entering") {
      const id = window.setTimeout(() => setPhase("unblurring"), enterMs);
      return () => window.clearTimeout(id);
    }
    if (phase === "unblurring") {
      const id = window.setTimeout(() => setPhase("scaling"), rampMs);
      return () => window.clearTimeout(id);
    }
    if (phase === "scaling") {
      const id = window.setTimeout(() => setPhase("open"), SCALE_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "closing") {
      const id = window.setTimeout(() => setPhase("shrinking"), CARDS_FADE_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "shrinking") {
      const id = window.setTimeout(() => setPhase("reblurring"), SCALE_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "reblurring") {
      onReblurringRef.current?.();
      const id = window.setTimeout(() => {
        setPhase("closed");
        onClosedRef.current?.();
      }, rampMs);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "closed") return;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadRight;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const target = useMemo(() => {
    const scale = Math.max(viewport.w / INTERIOR_W, viewport.h / INTERIOR_H);
    const outerW = PORTAL_NATIVE_W * scale;
    const outerH = PORTAL_NATIVE_H * scale;
    const left = viewport.w / 2 - (INTERIOR_OFFSET + INTERIOR_W / 2) * scale;
    const top = viewport.h / 2 - (INTERIOR_OFFSET + INTERIOR_H / 2) * scale;
    return {
      scale,
      outer: { left, top, w: outerW, h: outerH },
    };
  }, [viewport]);

  if (phase === "closed") return null;
  if (!sourceRect) return null;

  const sourceScale = sourceRect.width / PORTAL_NATIVE_W;
  const sourceTransform = `translate3d(${sourceRect.left}px, ${sourceRect.top}px, 0) scale(${sourceScale})`;
  const targetTransform = `translate3d(${target.outer.left}px, ${target.outer.top}px, 0) scale(${target.scale})`;

  const transformIsTarget =
    phase === "scaling" || phase === "open" || phase === "closing";
  const atSourceLook = phase === "entering" || phase === "reblurring";
  const cardsVisible = phase === "open";
  const transform = transformIsTarget ? targetTransform : sourceTransform;

  const sourceIsAmbient = viewport.w < 1024;
  const sourceFilter = sourceIsAmbient
    ? "blur(13px) saturate(0.8) brightness(0.75)"
    : undefined;
  const targetFilter = sourceIsAmbient ? "blur(0.5px)" : undefined;
  const portalFilter = atSourceLook ? sourceFilter : targetFilter;
  const portalOpacity =
    sourceIsAmbient && (phase === "entering" || phase === "reblurring") ? 0 : 1;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden text-white">
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: PORTAL_NATIVE_W,
          height: PORTAL_NATIVE_H,
          transformOrigin: "top left",
          transform,
          filter: portalFilter,
          opacity: portalOpacity,
          backfaceVisibility: "hidden",
          transition: `transform ${SCALE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${RAMP_MS}ms ease-out, opacity ${RAMP_MS}ms ease-out`,
        }}
      >
        <PortalFrame
          blockSize={PORTAL_BLOCK_SIZE}
          variant={sourceIsAmbient ? "ambient" : "hero"}
          idleGlow={false}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-black/70 backdrop-blur-2xl transition-opacity"
        style={{
          opacity: cardsVisible ? 1 : 0,
          transitionDuration: `${CARDS_FADE_MS}ms`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity"
        style={{
          opacity: cardsVisible ? 1 : 0,
          transitionDuration: `${CARDS_FADE_MS}ms`,
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.45 0.2 258 / 0.28), transparent 70%)",
        }}
        aria-hidden
      />

      <div
        className="absolute inset-0 flex flex-col transition-opacity"
        style={{
          opacity: cardsVisible ? 1 : 0,
          transitionDuration: `${CARDS_FADE_MS}ms`,
        }}
      >
        <div className="flex h-full w-full flex-col">
          <OverlayHeader cycleNumber={cycleNumber} onClose={onClose} />
          <OverlayHero pool={pool} nextRotationAt={nextRotationAt} />
          <div className="mx-10 h-px bg-white/10" />
          <OverlayBody
            pool={pool}
            isLoading={isLoading}
            totalWeight={totalWeight}
            myBoostMap={myBoostMap}
            boostUnitPrice={boostUnitPrice}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface OverlayHeaderProps {
  cycleNumber: number | null;
  onClose: () => void;
}

function OverlayHeader({ cycleNumber, onClose }: OverlayHeaderProps) {
  return (
    <header className="flex items-center justify-between px-10 pt-7 pb-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/55">
        {cycleNumber != null ? `Cycle ${cycleNumber}` : "Cycle"}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit portal"
        className="group grid size-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-4 transition-transform duration-300 group-hover:rotate-90" />
      </button>
    </header>
  );
}

interface OverlayHeroProps {
  pool: PoolEntry[] | undefined;
  nextRotationAt: string | null;
}

function OverlayHero({ pool, nextRotationAt }: OverlayHeroProps) {
  const countdown = useCountdown(nextRotationAt) ?? "—";

  const leader = useMemo(() => {
    if (!pool || pool.length === 0) return null;
    return [...pool].sort((a, b) => b.weight - a.weight)[0];
  }, [pool]);

  const totalBoosts =
    pool?.reduce((sum, entry) => sum + entry.boostUnits, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 px-10 pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
      <h1 className="min-w-0 text-[40px] font-semibold leading-[1.05] tracking-[-0.02em]">
        Shape the next world.
      </h1>
      <div className="flex shrink-0 flex-wrap items-stretch gap-x-6 gap-y-4">
        <div className="hidden lg:contents">
          <MiniStat label="Leading" value={leader?.pack.name ?? "—"} accent />
          <div className="w-px bg-white/10" />
        </div>
        <MiniStat label="Rotation in" value={countdown} mono />
        <div className="w-px bg-white/10" />
        <MiniStat label="Total boosts" value={`${totalBoosts}`} mono />
      </div>
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}

function MiniStat({ label, value, mono, accent }: MiniStatProps) {
  return (
    <div className="flex min-w-0 flex-col justify-end">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-[15px] font-semibold",
          mono && "font-mono tabular-nums",
          accent ? "text-[var(--blue-bright)]" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

interface OverlayBodyProps {
  pool: PoolEntry[] | undefined;
  isLoading: boolean;
  totalWeight: number;
  myBoostMap: Map<number, number>;
  boostUnitPrice: number;
}

function OverlayBody({
  pool,
  isLoading,
  totalWeight,
  myBoostMap,
  boostUnitPrice,
}: OverlayBodyProps) {
  const sortedPool = useMemo(() => {
    if (!pool) return [];
    return [...pool].sort((a, b) => b.weight - a.weight);
  }, [pool]);

  const leaderId = sortedPool[0]?.pack.id ?? null;

  return (
    <div className="nice-scroll flex-1 overflow-y-auto px-10 py-6">
      {isLoading ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[168px] w-full rounded-xl" />
          ))}
        </div>
      ) : sortedPool.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          <Package className="mx-auto mb-2 size-8 opacity-50" />
          <p>No packs are available for voting right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
          {sortedPool.map((entry, i) => (
            <PackRowV3
              key={entry.pack.id}
              pack={entry.pack}
              weight={entry.weight}
              boostUnits={entry.boostUnits}
              totalWeight={totalWeight}
              myBoostUnits={myBoostMap.get(entry.pack.id) ?? 0}
              boostUnitPrice={boostUnitPrice}
              rank={i + 1}
              leader={entry.pack.id === leaderId}
            />
          ))}
        </div>
      )}
      <div className="mt-6 flex items-center justify-between gap-4 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <Info className="size-3" />
          Weights refresh every minute · boosts locked until next rotation
        </span>
        <span className="hidden shrink-0 md:inline">
          Press{" "}
          <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          to exit
        </span>
      </div>
    </div>
  );
}

interface PackRowV3Props {
  pack: PoolPack;
  weight: number;
  boostUnits: number;
  totalWeight: number;
  myBoostUnits: number;
  boostUnitPrice: number;
  rank: number;
  leader: boolean;
}

function PackRowV3({
  pack,
  weight,
  boostUnits,
  totalWeight,
  myBoostUnits,
  boostUnitPrice,
  rank,
  leader,
}: PackRowV3Props) {
  const [boostOpen, setBoostOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false);
  const modCount = pack.mods.length;
  const probability =
    totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;

  return (
    <>
      <div className="group relative flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-[var(--blue)]/40 hover:bg-white/[0.04]">
        {leader && (
          <div className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full border border-[var(--blue)]/40 bg-black px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-[var(--blue-bright)] lg:hidden">
            <TrendingUp className="size-2.5" />
            Leading
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              {String(rank).padStart(2, "0")}
            </div>
            <h3 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
              {pack.name}
            </h3>
            {pack.description && (
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/50">
                {pack.description}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[28px] font-semibold leading-none tabular-nums text-white">
              {probability}
              <span className="align-top text-[16px] text-[var(--blue-bright)]">
                %
              </span>
            </div>
          </div>
        </div>

        <div className="h-[3px] overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full"
            style={{
              width: `${probability}%`,
              background: "var(--blue-bright)",
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/45">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Blocks className="size-3" />
              {modCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Rocket className="size-3" />
              {boostUnits}
            </span>
            {myBoostUnits > 0 && (
              <span className="inline-flex items-center gap-1 text-[var(--blue-bright)]">
                +{myBoostUnits} yours
              </span>
            )}
          </div>
          <span className="font-mono tabular-nums text-white/35">
            w {weight.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setModsOpen(true)}
            disabled={modCount === 0}
            className="flex-1 rounded-md border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-white/25 hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-50"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={() => setBoostOpen(true)}
            className="flex-1 rounded-md bg-[var(--blue)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--blue-bright)]"
          >
            Boost
          </button>
        </div>
      </div>

      <PackModsDialog
        open={modsOpen}
        onOpenChange={setModsOpen}
        packName={pack.name}
        mods={pack.mods}
      />

      <BoostDialog
        open={boostOpen}
        onOpenChange={setBoostOpen}
        packId={pack.id}
        packName={pack.name}
        boostUnitPrice={boostUnitPrice}
      />
    </>
  );
}
