import type { ReactNode } from "react";
import { useElementSize } from "@/hooks/use-element-size";

type AutoHeightProps = {
  children: ReactNode;
  className?: string;
};

export function AutoHeight({ children, className }: AutoHeightProps) {
  const { ref: innerRef, size } = useElementSize<HTMLDivElement>();
  const height = size?.height ?? null;

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
