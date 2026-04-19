import React from "react";
import { useCurrentFrame } from "remotion";
import { theme } from "../theme";

type GearProps = {
  size: number;
  teeth?: number;
  color?: string;
  speed?: number; // degrees per frame
  direction?: 1 | -1;
  opacity?: number;
  strokeWidth?: number;
};

export const Gear: React.FC<GearProps> = ({
  size,
  teeth = 12,
  color = theme.primary,
  speed = 0.6,
  direction = 1,
  opacity = 1,
  strokeWidth = 8,
}) => {
  const frame = useCurrentFrame();
  const rotation = frame * speed * direction;

  const outerR = 50;
  const toothR = 58;
  const innerR = 38;
  const boreR = 14;

  const toothPoints: string[] = [];
  const toothHalfAngle = 360 / (teeth * 2) / 2;
  for (let i = 0; i < teeth; i++) {
    const center = (i * 360) / teeth;
    const a1 = ((center - toothHalfAngle) * Math.PI) / 180;
    const a2 = ((center + toothHalfAngle) * Math.PI) / 180;
    const a3 = (((i + 0.5) * 360) / teeth - toothHalfAngle) * (Math.PI / 180);
    const a4 = (((i + 0.5) * 360) / teeth + toothHalfAngle) * (Math.PI / 180);
    toothPoints.push(`${Math.cos(a1) * outerR},${Math.sin(a1) * outerR}`);
    toothPoints.push(`${Math.cos(a1) * toothR},${Math.sin(a1) * toothR}`);
    toothPoints.push(`${Math.cos(a2) * toothR},${Math.sin(a2) * toothR}`);
    toothPoints.push(`${Math.cos(a2) * outerR},${Math.sin(a2) * outerR}`);
    toothPoints.push(`${Math.cos(a3) * outerR},${Math.sin(a3) * outerR}`);
    toothPoints.push(`${Math.cos(a4) * outerR},${Math.sin(a4) * outerR}`);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="-70 -70 140 140"
      style={{
        transform: `rotate(${rotation}deg)`,
        opacity,
        display: "block",
      }}
    >
      <polygon
        points={toothPoints.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <circle cx="0" cy="0" r={innerR} fill="none" stroke={color} strokeWidth={strokeWidth * 0.6} />
      <circle cx="0" cy="0" r={boreR} fill="none" stroke={color} strokeWidth={strokeWidth * 0.6} />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i * Math.PI) / 3;
        return (
          <line
            key={i}
            x1={Math.cos(a) * boreR}
            y1={Math.sin(a) * boreR}
            x2={Math.cos(a) * innerR}
            y2={Math.sin(a) * innerR}
            stroke={color}
            strokeWidth={strokeWidth * 0.4}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};
