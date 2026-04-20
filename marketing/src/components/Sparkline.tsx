import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

type SparklineProps = {
  width: number;
  height: number;
  change: number;
  seed?: number;
  color: string;
  delay?: number;
};

function buildPath(width: number, height: number, change: number, seed: number): string {
  const N = 24;
  const padding = 2;
  const innerH = height - padding * 2;
  const clampedChange = Math.max(-30, Math.min(30, change));
  const drift = (clampedChange / 30) * (innerH * 0.4);
  const amp = innerH * 0.18;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = padding + t * (width - padding * 2);
    const wave = Math.sin(i * 1.3 + seed) * amp * 0.5 + Math.sin(i * 0.7 + seed * 2) * amp * 0.5;
    const y = padding + innerH / 2 - t * drift + wave * (1 - t * 0.3);
    pts.push(`${x.toFixed(1)},${Math.max(padding, Math.min(height - padding, y)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export const Sparkline: React.FC<SparklineProps> = ({
  width,
  height,
  change,
  seed = 0,
  color,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const path = buildPath(width, height, change, seed);
  const progress = interpolate(frame, [delay, delay + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const approxLen = width + Math.abs(change) * 2 + 20;
  const gradId = `sparkfill-${seed}`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${path} ${width - 2},${height - 2} 2,${height - 2}`}
        fill={`url(#${gradId})`}
        opacity={progress}
      />
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={approxLen}
        strokeDashoffset={approxLen * (1 - progress)}
      />
      {progress > 0.95 && (
        <circle
          cx={width - 2}
          cy={parseFloat(path.split(" ").pop()!.split(",")[1]!)}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
};
