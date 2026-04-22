import { useState } from "react";

interface FloatingDustParticle {
  x0: string;
  x1: string;
  d: string;
  delay: string;
  o: number;
  size: number;
}

interface FloatingDustProps {
  count: number;
  unit?: "%" | "vw";
}

export function FloatingDust({ count, unit = "%" }: FloatingDustProps) {
  const [items] = useState<FloatingDustParticle[]>(() =>
    Array.from({ length: count }).map(() => {
      const x0 = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 20;
      return {
        x0: `${x0}${unit}`,
        x1: `${x0 + drift}${unit}`,
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
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
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
