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
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      prevRef.current = value;
      setDisplay(value);
      return;
    }

    const prev = prevRef.current;
    prevRef.current = value;

    if (prev === value) return;

    setFlash(value > prev ? "up" : "down");

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    const start = performance.now();
    const duration = 350;
    const diff = value - prev;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(prev + diff * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
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
