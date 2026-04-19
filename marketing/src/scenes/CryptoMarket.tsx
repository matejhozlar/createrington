import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { BrowserFrame } from "../components/BrowserFrame";
import { CandlestickChart, type Candle } from "../components/CandlestickChart";
import { Sparkline } from "../components/Sparkline";
import { TradeStream } from "../components/TradeStream";
import { SCREENSHOTS } from "../components/assets";

const CARD = "#1e1c22";
const CARD_BORDER = "rgba(255, 255, 255, 0.08)";

const COLORS = {
  emerald: "#34d399",
  orange: "#fb923c",
  blue: "#60a5fa",
  purple: "#c084fc",
} as const;

const TICKERS = [
  { sym: "RGC", name: "Ringcoin",      price: 1.00,  change: 2.1,   category: "stable"   as const, tag: "pegged"  as const },
  { sym: "DDG", name: "DiamondDoge",   price: 15.00, change: 22.1,  category: "memecoin" as const, tag: "rocket"  as const },
  { sym: "CRP", name: "CreeperCash",   price: 2.50,  change: -15.4, category: "memecoin" as const, tag: "normal"  as const },
  { sym: "RSR", name: "RedstoneRuble", price: 5.00,  change: 4.7,   category: "memecoin" as const, tag: "normal"  as const },
  { sym: "FLF", name: "FluffCoin",     price: 0.50,  change: 8.2,   category: "memecoin" as const, tag: "normal"  as const },
  { sym: "END", name: "EnderToken",    price: 0.01,  change: -32.8, category: "memecoin" as const, tag: "crash"   as const },
];

const RGC_CANDLES: Candle[] = [
  { o: 0.62, c: 0.65, h: 0.67, l: 0.60 },
  { o: 0.65, c: 0.64, h: 0.68, l: 0.62 },
  { o: 0.64, c: 0.68, h: 0.70, l: 0.63 },
  { o: 0.68, c: 0.72, h: 0.73, l: 0.67 },
  { o: 0.72, c: 0.71, h: 0.74, l: 0.70 },
  { o: 0.71, c: 0.69, h: 0.72, l: 0.67 },
  { o: 0.69, c: 0.73, h: 0.75, l: 0.68 },
  { o: 0.73, c: 0.78, h: 0.80, l: 0.72 },
  { o: 0.78, c: 0.77, h: 0.81, l: 0.75 },
  { o: 0.77, c: 0.82, h: 0.83, l: 0.76 },
  { o: 0.82, c: 0.86, h: 0.88, l: 0.81 },
  { o: 0.86, c: 0.84, h: 0.87, l: 0.82 },
  { o: 0.84, c: 0.89, h: 0.91, l: 0.83 },
  { o: 0.89, c: 0.93, h: 0.95, l: 0.88 },
  { o: 0.93, c: 0.91, h: 0.95, l: 0.90 },
  { o: 0.91, c: 0.96, h: 0.98, l: 0.90 },
  { o: 0.96, c: 1.00, h: 1.02, l: 0.95 },
  { o: 1.00, c: 0.98, h: 1.03, l: 0.96 },
  { o: 0.98, c: 1.04, h: 1.06, l: 0.97 },
  { o: 1.04, c: 1.08, h: 1.10, l: 1.03 },
];

const TRADES = [
  { player: "saunhardy",  side: "buy"  as const, amount: 500,  sym: "RGC", symColor: COLORS.emerald, price: 1.08 },
  { player: "matejhoz",   side: "sell" as const, amount: 12,   sym: "CRP", symColor: COLORS.orange,  price: 2.50 },
  { player: "pixelkind",  side: "buy"  as const, amount: 50,   sym: "DDG", symColor: COLORS.orange,  price: 14.95 },
  { player: "ironrails",  side: "sell" as const, amount: 2500, sym: "END", symColor: COLORS.orange,  price: 0.0105 },
  { player: "steamfox",   side: "buy"  as const, amount: 120,  sym: "RSR", symColor: COLORS.orange,  price: 5.02 },
  { player: "cogwarden",  side: "buy"  as const, amount: 800,  sym: "FLF", symColor: COLORS.orange,  price: 0.5048 },
  { player: "saunhardy",  side: "sell" as const, amount: 40,   sym: "DDG", symColor: COLORS.orange,  price: 15.10 },
  { player: "aetherdust", side: "buy"  as const, amount: 1200, sym: "RGC", symColor: COLORS.emerald, price: 1.08 },
  { player: "flintspark", side: "buy"  as const, amount: 75,   sym: "CRP", symColor: COLORS.orange,  price: 2.48 },
];

const svgBase = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const RocketIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svgBase}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);
const SkullIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...svgBase}>
    <path d="M12 2a9 9 0 0 0-9 9v4l2 3v3h4v-2h6v2h4v-3l2-3v-4a9 9 0 0 0-9-9z" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <path d="M10 16h4" />
  </svg>
);

const categoryColor = (c: string) =>
  c === "stable" ? COLORS.emerald : c === "blue_chip" ? COLORS.blue : c === "seasonal" ? COLORS.purple : COLORS.orange;

export const CryptoMarket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [196, 222], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const chartIn = spring({ frame: frame - 18, fps, config: { damping: 20, stiffness: 90 } });
  const tickPulse = (Math.sin(frame / 6) + 1) / 2;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/mountains-train-station.webp"
        zoom={[1.04, 1.12]}
        blur={22}
        darken={0.85}
        gradient="none"
        durationInFrames={224}
      />

      <AbsoluteFill style={{ padding: "70px 90px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              opacity: headerIn,
              transform: `translateY(${(1 - headerIn) * 20}px)`,
            }}
          >
            <div
              style={{
                fontSize: 22,
                letterSpacing: 8,
                color: theme.primary,
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              In-Game Economy
            </div>
            <h2
              style={{
                fontSize: 68,
                fontWeight: 700,
                color: theme.foreground,
                letterSpacing: -1.5,
                margin: 0,
              }}
            >
              A simulated <span style={{ color: theme.primary }}>crypto market</span>.
            </h2>
            <div
              style={{
                marginTop: 14,
                fontSize: 22,
                color: theme.mutedForeground,
                maxWidth: 900,
              }}
            >
              Fictional tokens, no real money. Ringcoin anchors the economy;
              memecoins swing on community hype. Limit orders, stop-loss, IPOs,
              generated news, and weekly reports — all streamed in real time.
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 6,
              background: "rgba(24, 24, 27, 0.7)",
              border: `1px solid ${theme.border}`,
              color: COLORS.emerald,
              fontSize: 18,
              fontWeight: 500,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
              opacity: headerIn,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: COLORS.emerald,
                opacity: 0.4 + tickPulse * 0.6,
              }}
            />
            Live
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.55fr 1fr",
            gap: 24,
            alignItems: "stretch",
            opacity: chartIn,
            transform: `translateY(${(1 - chartIn) * 30}px)`,
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              background: CARD,
              borderRadius: 20,
              border: `1px solid ${CARD_BORDER}`,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${COLORS.emerald}1a`,
                  border: `1px solid ${COLORS.emerald}55`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.emerald,
                  fontWeight: 800,
                  fontSize: 16,
                  fontFamily: theme.fontMono,
                }}
              >
                RGC
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.foreground }}>
                  Ringcoin · RGC / $
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: theme.mutedForeground,
                    fontFamily: theme.fontMono,
                  }}
                >
                  Stablecoin · pegged to server activity
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: theme.foreground,
                    fontFamily: theme.fontMono,
                  }}
                >
                  $1.08
                </div>
                <div style={{ fontSize: 14, color: COLORS.emerald, fontFamily: theme.fontMono }}>
                  +11.34% · 24h
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <CandlestickChart
                width={900}
                height={460}
                startFrame={20}
                candleDuration={7}
                candles={RGC_CANDLES}
                currency="$"
                formatPrice={(n) => n.toFixed(2)}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TICKERS.map((t, i) => {
              const delay = 28 + i * 9;
              const tickerIn = spring({
                frame: frame - delay,
                fps,
                config: { damping: 18, stiffness: 110 },
              });
              const positive = t.change > 0;
              const flash = (Math.sin((frame - i * 4) / 8) + 1) / 2;
              const dotColor = categoryColor(t.category);
              const changeColor =
                t.change === 0 ? theme.mutedForeground : positive ? COLORS.emerald : theme.destructive;
              const stable = t.category === "stable";

              const priceStr =
                t.price < 0.01
                  ? t.price.toFixed(6)
                  : t.price < 1
                    ? t.price.toFixed(4)
                    : t.price.toFixed(2);

              const pulsePhase = (frame + i * 23) % 48;
              const priceFlash = pulsePhase < 10 ? (10 - pulsePhase) / 10 : 0;

              return (
                <div
                  key={t.sym}
                  style={{
                    background: stable ? `${COLORS.emerald}0d` : CARD,
                    border: `1px solid ${stable ? `${COLORS.emerald}44` : CARD_BORDER}`,
                    borderRadius: 12,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    opacity: tickerIn,
                    transform: `translateX(${(1 - tickerIn) * 40}px)`,
                    boxShadow: stable ? `0 0 24px ${COLORS.emerald}22` : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${dotColor}1a`,
                      border: `1px solid ${dotColor}55`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: dotColor,
                      fontFamily: theme.fontMono,
                      fontWeight: 700,
                      fontSize: 12,
                      position: "relative",
                    }}
                  >
                    {t.sym}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        color: theme.foreground,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {t.name}
                      {t.tag === "rocket" && (
                        <span style={{ color: theme.primary, opacity: 0.7 + flash * 0.3 }}>
                          <RocketIcon size={13} />
                        </span>
                      )}
                      {t.tag === "crash" && (
                        <span style={{ color: `${theme.destructive}cc` }}>
                          <SkullIcon size={13} />
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: theme.mutedForeground,
                        textTransform: "capitalize",
                        fontFamily: theme.fontMono,
                        marginTop: 1,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: dotColor,
                          marginRight: 6,
                          verticalAlign: "middle",
                        }}
                      />
                      {t.category}
                    </div>
                  </div>

                  <div style={{ width: 70, height: 32, flexShrink: 0 }}>
                    <Sparkline
                      width={70}
                      height={32}
                      change={t.change}
                      seed={i}
                      color={changeColor}
                      delay={delay + 6}
                    />
                  </div>

                  <div style={{ textAlign: "right", minWidth: 82 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontFamily: theme.fontMono,
                        color: theme.foreground,
                        fontWeight: 600,
                        textShadow:
                          priceFlash > 0
                            ? `0 0 ${8 * priceFlash}px ${changeColor}`
                            : "none",
                        transition: "text-shadow 60ms linear",
                      }}
                    >
                      ${priceStr}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: theme.fontMono,
                        color: changeColor,
                        opacity: 0.7 + flash * 0.3,
                      }}
                    >
                      {positive ? "▲" : t.change === 0 ? "·" : "▼"} {Math.abs(t.change).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                opacity: interpolate(frame, [60, 84], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `perspective(1400px) rotateY(-4deg)`,
                transformOrigin: "right center",
              }}
            >
              <BrowserFrame
                src={SCREENSHOTS.cryptoPortfolio}
                url="createrington.com/crypto/portfolio"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "10px 18px",
            background: CARD,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: interpolate(frame, [40, 64], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              borderRadius: 6,
              background: `${theme.primary}1a`,
              border: `1px solid ${theme.primary}55`,
              color: theme.primary,
              fontSize: 11,
              fontFamily: theme.fontMono,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: theme.primary,
                opacity: 0.4 + tickPulse * 0.6,
              }}
            />
            Trades
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TradeStream trades={TRADES} width={1600} speedPxPerSec={90} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
