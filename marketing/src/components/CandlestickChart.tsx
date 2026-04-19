import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export type Candle = { o: number; h: number; l: number; c: number };

const DEFAULT_CANDLES: Candle[] = [
  { o: 42, c: 45, h: 47, l: 41 },
  { o: 45, c: 44, h: 47, l: 43 },
  { o: 44, c: 48, h: 50, l: 44 },
  { o: 48, c: 52, h: 53, l: 47 },
  { o: 52, c: 51, h: 54, l: 50 },
  { o: 51, c: 49, h: 52, l: 47 },
  { o: 49, c: 53, h: 54, l: 48 },
  { o: 53, c: 58, h: 60, l: 52 },
  { o: 58, c: 57, h: 61, l: 55 },
  { o: 57, c: 62, h: 63, l: 56 },
  { o: 62, c: 66, h: 68, l: 61 },
  { o: 66, c: 64, h: 67, l: 62 },
  { o: 64, c: 69, h: 71, l: 63 },
  { o: 69, c: 73, h: 75, l: 68 },
  { o: 73, c: 71, h: 75, l: 70 },
  { o: 71, c: 76, h: 78, l: 70 },
  { o: 76, c: 80, h: 82, l: 75 },
  { o: 80, c: 78, h: 83, l: 76 },
  { o: 78, c: 84, h: 86, l: 77 },
  { o: 84, c: 88, h: 90, l: 83 },
];

type ChartProps = {
  width: number;
  height: number;
  startFrame?: number;
  candleDuration?: number;
  candles?: Candle[];
  priceRange?: [number, number];
  gridPrices?: number[];
  currency?: string;
  formatPrice?: (n: number) => string;
};

const EMERALD = "#34d399";

export const CandlestickChart: React.FC<ChartProps> = ({
  width,
  height,
  startFrame = 0,
  candleDuration = 5,
  candles = DEFAULT_CANDLES,
  priceRange,
  gridPrices: gridPricesProp,
  currency = "$",
  formatPrice,
}) => {
  const frame = useCurrentFrame();
  const padding = { top: 20, right: 44, bottom: 20, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const derived = React.useMemo(() => {
    const hi = Math.max(...candles.map((c) => c.h));
    const lo = Math.min(...candles.map((c) => c.l));
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad] as [number, number];
  }, [candles]);
  const [minPrice, maxPrice] = priceRange ?? derived;
  const priceToY = (p: number) =>
    padding.top + innerH - ((p - minPrice) / (maxPrice - minPrice)) * innerH;

  const candleW = innerW / candles.length;
  const bodyW = candleW * 0.6;

  const visibleCount = Math.min(
    candles.length,
    Math.max(0, Math.floor((frame - startFrame) / candleDuration)),
  );

  const gridPrices =
    gridPricesProp ??
    Array.from({ length: 5 }, (_, i) => minPrice + ((maxPrice - minPrice) * (i + 0.5)) / 5);

  const fmt = formatPrice ?? ((n: number) => n.toFixed(2));

  const cursorCandleIdx = Math.max(0, visibleCount - 1);
  const cursorCandle = candles[cursorCandleIdx];
  const cursorPrice = cursorCandle?.c ?? candles[0]!.c;
  const cursorY = priceToY(cursorPrice);

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <rect x={0} y={0} width={width} height={height} rx={16} fill={theme.card} />
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={16}
        fill="none"
        stroke={theme.border}
      />

      {gridPrices.map((p) => (
        <g key={p}>
          <line
            x1={padding.left}
            y1={priceToY(p)}
            x2={width - padding.right}
            y2={priceToY(p)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="4 6"
          />
          <text
            x={width - padding.right + 6}
            y={priceToY(p) + 4}
            fontSize={12}
            fill={theme.mutedForeground}
            fontFamily={theme.fontMono}
          >
            {currency}
            {fmt(p)}
          </text>
        </g>
      ))}

      {candles.slice(0, visibleCount).map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? EMERALD : theme.destructive;
        const x = padding.left + i * candleW + candleW / 2;
        const appearFrame = startFrame + i * candleDuration;
        const t = interpolate(frame, [appearFrame, appearFrame + candleDuration], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const bodyTop = priceToY(Math.max(c.o, c.c));
        const bodyBottom = priceToY(Math.min(c.o, c.c));
        const bodyH = Math.max(2, (bodyBottom - bodyTop) * t);
        return (
          <g key={i} opacity={t}>
            <line
              x1={x}
              y1={priceToY(c.h)}
              x2={x}
              y2={priceToY(c.l)}
              stroke={color}
              strokeWidth={1.5}
            />
            <rect
              x={x - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              fill={color}
              rx={1}
            />
          </g>
        );
      })}

      {visibleCount > 0 && (
        <g>
          <line
            x1={padding.left}
            y1={cursorY}
            x2={width - padding.right}
            y2={cursorY}
            stroke={theme.primary}
            strokeDasharray="3 4"
            strokeWidth={1}
            opacity={0.7}
          />
          <rect
            x={width - padding.right - 58}
            y={cursorY - 11}
            width={52}
            height={22}
            rx={4}
            fill={theme.primary}
          />
          <text
            x={width - padding.right - 32}
            y={cursorY + 4}
            fontSize={12}
            fontFamily={theme.fontMono}
            fontWeight={600}
            fill={theme.backgroundDeep}
            textAnchor="middle"
          >
            {currency}
            {fmt(cursorPrice)}
          </text>
        </g>
      )}
    </svg>
  );
};
