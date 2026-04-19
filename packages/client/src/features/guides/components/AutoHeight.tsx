import { useEffect, useRef, useState, type ReactNode } from "react";

type AutoHeightProps = {
  children: ReactNode;
  className?: string;
  /** Disables the height transition on first mount to avoid an open animation. */
  animateInitial?: boolean;
};

export function AutoHeight({
  children,
  className,
  animateInitial = false,
}: AutoHeightProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [hasMeasured, setHasMeasured] = useState(false);

  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;

    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setHeight(entry.contentRect.height);
      setHasMeasured(true);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shouldAnimate = animateInitial || hasMeasured;

  return (
    <div
      className={className}
      style={{
        height: height ?? undefined,
        transition: shouldAnimate ? "height 350ms ease" : undefined,
        overflow: "hidden",
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
