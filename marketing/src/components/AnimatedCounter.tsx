import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

type CounterProps = {
  from?: number;
  to: number;
  durationInFrames: number;
  delay?: number;
  suffix?: string;
  formatFn?: (n: number) => string;
  style?: React.CSSProperties;
};

export const AnimatedCounter: React.FC<CounterProps> = ({
  from = 0,
  to,
  durationInFrames,
  delay = 0,
  suffix = "",
  formatFn,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - progress, 3);
  const current = from + (to - from) * eased;
  const display = formatFn ? formatFn(current) : Math.round(current).toLocaleString();

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {display}
      {suffix}
    </span>
  );
};
