import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Package, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PackCard } from "../PackCard";
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
  sourceRect: DOMRect | null;
  pool: PoolEntry[] | undefined;
  isLoading: boolean;
  totalWeight: number;
  myBoostMap: Map<number, number>;
  boostUnitPrice: number;
}

const PORTAL_BLOCK_SIZE = 72;
const PORTAL_COLS = 4;
const PORTAL_ROWS = 5;
const PORTAL_NATIVE_W = PORTAL_COLS * PORTAL_BLOCK_SIZE;
const PORTAL_NATIVE_H = PORTAL_ROWS * PORTAL_BLOCK_SIZE;
const INTERIOR_OFFSET = PORTAL_BLOCK_SIZE;
const INTERIOR_W = 2 * PORTAL_BLOCK_SIZE;
const INTERIOR_H = 3 * PORTAL_BLOCK_SIZE;

const SCALE_MS = 700;
const CARDS_FADE_MS = 360;

type Phase =
  | "closed"
  | "entering"
  | "scaling"
  | "open"
  | "closing"
  | "shrinking";

export function PortalZoomOverlay({
  open,
  onClose,
  onClosed,
  sourceRect,
  pool,
  isLoading,
  totalWeight,
  myBoostMap,
  boostUnitPrice,
}: PortalZoomOverlayProps) {
  const [phase, setPhase] = useState<Phase>("closed");
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 0,
    h: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  useEffect(() => {
    if (open && phase === "closed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("entering");
    } else if (!open && (phase === "open" || phase === "scaling")) {
      setPhase("closing");
    }
  }, [open, phase]);

  useEffect(() => {
    if (phase === "entering") {
      let cancelled = false;
      const id1 = requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          setPhase("scaling");
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id1);
      };
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
      const id = window.setTimeout(() => {
        setPhase("closed");
        onClosedRef.current?.();
      }, SCALE_MS);
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
  const sourceTransform = `translate(${sourceRect.left}px, ${sourceRect.top}px) scale(${sourceScale})`;
  const targetTransform = `translate(${target.outer.left}px, ${target.outer.top}px) scale(${target.scale})`;

  const atZoomed =
    phase === "scaling" || phase === "open" || phase === "closing";
  const cardsVisible = phase === "open";
  const transform = atZoomed ? targetTransform : sourceTransform;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: PORTAL_NATIVE_W,
          height: PORTAL_NATIVE_H,
          transformOrigin: "top left",
          transform,
          filter: cardsVisible ? "blur(0.5px)" : undefined,
          transition: `transform ${SCALE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${CARDS_FADE_MS}ms ease-out`,
        }}
      >
        <PortalFrame blockSize={PORTAL_BLOCK_SIZE} />
      </div>

      <div
        className="pointer-events-none absolute inset-0 transition-opacity"
        style={{
          opacity: cardsVisible ? 1 : 0,
          transitionDuration: `${CARDS_FADE_MS}ms`,
          background:
            "radial-gradient(ellipse at center, transparent 35%, oklch(0.1 0.05 275 / 0.55) 100%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 flex flex-col transition-opacity"
        style={{
          opacity: cardsVisible ? 1 : 0,
          transitionDuration: `${CARDS_FADE_MS}ms`,
        }}
        onClick={() => phase === "open" && onClose()}
      >
        <div
          className="pointer-events-auto flex h-full w-full flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <PoolHeader onClose={onClose} />
          <div className="flex-1 overflow-y-auto px-5 py-5 md:px-10 md:py-8">
            <div className="mx-auto w-full max-w-7xl">
              <PoolBody
                pool={pool}
                isLoading={isLoading}
                totalWeight={totalWeight}
                myBoostMap={myBoostMap}
                boostUnitPrice={boostUnitPrice}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PoolHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-5 py-3 backdrop-blur-md md:px-8 md:py-4">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/90">
          Through the portal
        </div>
        <h2 className="truncate text-lg font-semibold md:text-xl">
          Vote for Next Rotation
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit portal"
        className="group grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-white/10 hover:text-foreground"
      >
        <X className="size-4 transition-transform group-hover:rotate-90" />
      </button>
    </div>
  );
}

interface PoolBodyProps {
  pool: PoolEntry[] | undefined;
  isLoading: boolean;
  totalWeight: number;
  myBoostMap: Map<number, number>;
  boostUnitPrice: number;
}

function PoolBody({
  pool,
  isLoading,
  totalWeight,
  myBoostMap,
  boostUnitPrice,
}: PoolBodyProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!pool || pool.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-black/40 py-10 text-center text-muted-foreground backdrop-blur-sm">
        <Package className="mx-auto mb-2 size-8 opacity-50" />
        <p>No packs are available for voting right now.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {pool.map((entry) => (
        <PackCard
          key={entry.pack.id}
          pack={entry.pack}
          weight={entry.weight}
          boostUnits={entry.boostUnits}
          totalWeight={totalWeight}
          myBoostUnits={myBoostMap.get(entry.pack.id) ?? 0}
          boostUnitPrice={boostUnitPrice}
        />
      ))}
    </div>
  );
}
