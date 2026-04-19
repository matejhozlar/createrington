import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type Trade = {
  player: string;
  side: "buy" | "sell";
  amount: number;
  sym: string;
  symColor: string;
  price: number;
};

type TradeStreamProps = {
  trades: Trade[];
  width: number;       // visible width — used to compute the marquee distance
  speedPxPerSec?: number;
};

const formatPrice = (p: number) =>
  p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(4) : p.toFixed(2);

// A horizontally-scrolling marquee of simulated fills. Rendered in two
// concatenated copies so the loop is seamless as the first copy exits
// the left edge.
export const TradeStream: React.FC<TradeStreamProps> = ({
  trades,
  width,
  speedPxPerSec = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const seconds = frame / fps;
  // Approximate the single-copy width from item count. We let the CSS
  // render determine actual size, but use a generous estimate for the
  // modulo so the marquee loops cleanly.
  const approxCopyWidth = trades.length * 320;
  const shift = -((seconds * speedPxPerSec) % approxCopyWidth);

  const renderRow = (key: string) =>
    trades.map((t, i) => {
      const sideColor = t.side === "buy" ? "#34d399" : theme.destructive;
      return (
        <span
          key={`${key}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginRight: 36,
            fontFamily: theme.fontMono,
            fontSize: 14,
            color: theme.mutedForeground,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: theme.foreground }}>@{t.player}</span>
          <span style={{ color: sideColor, fontWeight: 700, textTransform: "uppercase" }}>
            {t.side}
          </span>
          <span style={{ color: theme.foreground, fontVariantNumeric: "tabular-nums" }}>
            {t.amount.toLocaleString()}
          </span>
          <span style={{ color: t.symColor, fontWeight: 700 }}>{t.sym}</span>
          <span style={{ color: theme.mutedForeground }}>@</span>
          <span style={{ color: theme.foreground, fontVariantNumeric: "tabular-nums" }}>
            ${formatPrice(t.price)}
          </span>
          <span style={{ color: theme.border, margin: "0 6px" }}>·</span>
        </span>
      );
    });

  return (
    <div
      style={{
        width,
        overflow: "hidden",
        position: "relative",
        // Edge fades so entries slide in/out behind a soft gradient.
        maskImage: "linear-gradient(to right, transparent 0, black 40px, black calc(100% - 40px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 40px, black calc(100% - 40px), transparent 100%)",
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          display: "inline-block",
          transform: `translateX(${shift}px)`,
          willChange: "transform",
        }}
      >
        {renderRow("a")}
        {renderRow("b")}
      </div>
    </div>
  );
};
