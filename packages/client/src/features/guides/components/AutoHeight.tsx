import { useEffect, useRef, useState, type ReactNode } from "react";

type AutoHeightProps = {
  children: ReactNode;
  className?: string;
};

export function AutoHeight({ children, className }: AutoHeightProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;

    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setHeight(entry.contentRect.height);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={className}
      style={{
        height: height ?? undefined,
        transition: height !== null ? "height 350ms ease" : undefined,
        overflow: "hidden",
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
