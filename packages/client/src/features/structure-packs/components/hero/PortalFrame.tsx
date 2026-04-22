import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { PortalTile } from "./PortalTile";

interface PortalFrameProps {
  blockSize?: number;
  className?: string;
  variant?: "hero" | "ambient";
  interactive?: boolean;
  onActivate?: () => void;
  ariaLabel?: string;
  idleGlow?: boolean;
}

const COLS = 4;
const ROWS = 5;

const isInterior = (r: number, c: number) =>
  r >= 1 && r <= 3 && c >= 1 && c <= 2;

export const PortalFrame = forwardRef<HTMLDivElement, PortalFrameProps>(
  function PortalFrame(
    {
      blockSize = 72,
      className,
      variant = "hero",
      interactive = false,
      onActivate,
      ariaLabel,
      idleGlow = false,
    },
    ref,
  ) {
    const outerW = COLS * blockSize;
    const outerH = ROWS * blockSize;
    const interiorW = blockSize * 2;
    const interiorH = blockSize * 3;

    const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!interactive || !onActivate) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "packs-hero-portal-root relative",
          interactive && "cursor-pointer outline-none",
          className,
        )}
        style={{ width: outerW, height: outerH }}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? (ariaLabel ?? "Enter portal") : undefined}
        onClick={interactive ? onActivate : undefined}
        onKeyDown={interactive ? handleKey : undefined}
      >
        {interactive && (
          <div
            aria-hidden
            className="packs-hero-portal-glow pointer-events-none absolute inset-0"
          />
        )}

        <div
          className={cn(
            "absolute inset-0",
            interactive && "packs-hero-portal-interactive",
          )}
        >
          <div
            className="packs-hero-breathe pointer-events-none absolute"
            style={{
              inset: -blockSize * 0.9,
              background:
                "radial-gradient(ellipse at center, oklch(0.62 0.19 255 / 0.45) 0%, oklch(0.62 0.19 255 / 0.15) 35%, transparent 65%)",
              filter: "blur(28px)",
            }}
          />

          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${COLS}, ${blockSize}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${blockSize}px)`,
            }}
          >
            {Array.from({ length: ROWS * COLS }).map((_, i) => {
              const r = Math.floor(i / COLS);
              const c = i % COLS;
              if (isInterior(r, c)) return <div key={i} />;
              return (
                <div
                  key={i}
                  className="packs-hero-obsidian"
                  style={{ width: blockSize, height: blockSize }}
                />
              );
            })}
          </div>

          <div
            className="absolute overflow-hidden"
            style={{
              top: blockSize,
              left: blockSize,
              width: interiorW,
              height: interiorH,
            }}
          >
            <PortalTile
              width={interiorW}
              height={interiorH}
              tileSize={blockSize}
            />

            <div
              className="packs-hero-breathe pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, oklch(0.62 0.19 255 / 0.18) 0%, oklch(0.62 0.19 255 / 0.3) 55%, oklch(0.62 0.19 255 / 0.55) 100%)",
                boxShadow: "inset 0 0 0 1px oklch(0.9 0.02 255 / 0.3)",
              }}
            />

            <div className="packs-hero-scanlines absolute inset-0" />
          </div>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow:
                variant === "ambient"
                  ? "0 0 120px oklch(0.62 0.19 255 / 0.35)"
                  : idleGlow
                    ? "0 0 90px oklch(0.62 0.19 255 / 0.35), 0 30px 80px rgba(0,0,0,0.7)"
                    : "0 30px 80px rgba(0,0,0,0.7)",
              transition: "box-shadow 600ms ease-out",
            }}
          />
        </div>
      </div>
    );
  },
);
