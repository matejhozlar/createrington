import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

type NumberCountUpProps = {
  to: number;
  delay?: number;
  durationInFrames?: number;
  suffix?: string;
  style?: React.CSSProperties;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function format(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return `${Math.round(n)}`;
}

export const NumberCountUp: React.FC<NumberCountUpProps> = ({
  to,
  delay = 0,
  durationInFrames = 50,
  suffix = "",
  style,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const value = to * easeOutCubic(t);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", display: "inline-block", ...style }}>
      {format(value)}
      {suffix}
    </span>
  );
};
