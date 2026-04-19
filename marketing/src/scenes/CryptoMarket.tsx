import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { BrowserFrame } from "../components/BrowserFrame";
import { CandlestickChart } from "../components/CandlestickChart";
import { SCREENSHOTS } from "../components/assets";

const TICKERS = [
  { sym: "DGOLD", name: "Digital Gold", price: 128.42, change: 4.2, tier: "blue-chip", tint: theme.chart.amber },
  { sym: "CRTN", name: "Createrington", price: 88.17, change: 12.6, tier: "blue-chip", tint: theme.chart.blue },
  { sym: "MEMEX", name: "Memecoin-X", price: 2.04, change: -18.3, tier: "meme", tint: theme.chart.red },
  { sym: "PEG", name: "Stable Peg", price: 1.0, change: 0.0, tier: "stable", tint: theme.chart.green },
];

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
  const screenshotIn = spring({ frame: frame - 60, fps, config: { damping: 20, stiffness: 80 } });
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
        {/* Header */}
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
              A live <span style={{ color: theme.primary }}>crypto market</span>.
            </h2>
            <div
              style={{
                marginTop: 14,
                fontSize: 22,
                color: theme.mutedForeground,
                maxWidth: 900,
              }}
            >
              Memecoins, stablecoins, blue-chips. Limit orders, stop-loss, IPOs,
              and AI-generated news — streamed in real time.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              background: `${theme.success}1a`,
              border: `1px solid ${theme.success}55`,
              color: theme.success,
              fontSize: 16,
              fontFamily: theme.fontMono,
              opacity: headerIn,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: theme.success,
                opacity: 0.4 + tickPulse * 0.6,
                boxShadow: `0 0 ${4 + tickPulse * 12}px ${theme.success}`,
              }}
            />
            LIVE · TICKING
          </div>
        </div>

        {/* Main display: custom chart panel + ticker column */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 24,
            alignItems: "stretch",
            opacity: chartIn,
            transform: `translateY(${(1 - chartIn) * 30}px)`,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Chart + screenshot pip */}
          <div
            style={{
              background: theme.card,
              borderRadius: 20,
              border: `1px solid ${theme.border}`,
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
                  background: theme.primarySoft,
                  border: `1px solid ${theme.primary}55`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.primary,
                  fontWeight: 800,
                  fontSize: 16,
                  fontFamily: theme.fontMono,
                }}
              >
                CRT
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.foreground }}>
                  Createrington · CRTN / €
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: theme.mutedForeground,
                    fontFamily: theme.fontMono,
                  }}
                >
                  1m · OHLCV · order book matched
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
                  €88.17
                </div>
                <div style={{ fontSize: 14, color: theme.success, fontFamily: theme.fontMono }}>
                  +12.60% · 24h
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <CandlestickChart
                width={900}
                height={460}
                startFrame={20}
                candleDuration={7}
              />
            </div>
          </div>

          {/* Right column: tickers (top) + real screenshot of portfolio (bottom) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TICKERS.map((t, i) => {
                const delay = 28 + i * 10;
                const tickerIn = spring({
                  frame: frame - delay,
                  fps,
                  config: { damping: 18, stiffness: 110 },
                });
                const positive = t.change > 0;
                const flash = (Math.sin((frame - i * 4) / 8) + 1) / 2;
                return (
                  <div
                    key={t.sym}
                    style={{
                      background: theme.card,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 14,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      opacity: tickerIn,
                      transform: `translateX(${(1 - tickerIn) * 40}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: `${t.tint}1a`,
                        border: `1px solid ${t.tint}55`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: t.tint,
                        fontFamily: theme.fontMono,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {t.sym.slice(0, 3)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, color: theme.foreground, fontWeight: 600 }}>
                        {t.sym}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: theme.mutedForeground,
                          textTransform: "capitalize",
                        }}
                      >
                        {t.tier}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontFamily: theme.fontMono,
                          color: theme.foreground,
                          fontWeight: 600,
                        }}
                      >
                        €{t.price.toFixed(2)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: theme.fontMono,
                          color:
                            t.change === 0
                              ? theme.mutedForeground
                              : positive
                              ? theme.success
                              : theme.destructive,
                          opacity: 0.7 + flash * 0.3,
                        }}
                      >
                        {positive ? "▲" : t.change === 0 ? "·" : "▼"}{" "}
                        {Math.abs(t.change).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Real screenshot pip — shows that this is a real running app */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                opacity: screenshotIn,
                transform: `translateY(${(1 - screenshotIn) * 24}px) perspective(1400px) rotateY(-4deg)`,
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
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
