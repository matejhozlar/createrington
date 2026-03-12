import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = (n) => n.toString(),
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const prev = prevRef.current;

    if (prev === value) return;

    setFlash(value > prev ? "up" : "down");

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    const startTime = performance.now();
    const duration = 600;
    const diff = value - prev;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setDisplay(prev + diff * progress);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    timerRef.current = setTimeout(() => setFlash(null), 1200);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  return (
    <span
      className={cn(
        "transition-colors duration-700",
        flash === "up" && "!text-emerald-400",
        flash === "down" && "!text-red-400",
        className,
      )}
    >
      {format(display)}
    </span>
  );
}
