import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { BrowserFrame } from "../components/BrowserFrame";
import { SCREENSHOTS } from "../components/assets";

// Stacked, parallaxed browser frames — similar to Linear / Vercel marketing
// pages — each tilted slightly and offset to feel like product stills.
const FRAMES = [
  {
    src: SCREENSHOTS.homepage,
    url: "createrington.com",
    width: 1100,
    height: 680,
    top: 100,
    left: 80,
    rotate: 2,
    delay: 6,
    z: 1,
  },
  {
    src: SCREENSHOTS.adminDashboard,
    url: "createrington.com/admin",
    width: 1000,
    height: 620,
    top: 220,
    left: 520,
    rotate: -3,
    delay: 18,
    z: 2,
  },
  {
    src: SCREENSHOTS.cryptoMarket,
    url: "createrington.com/crypto",
    width: 900,
    height: 560,
    top: 380,
    left: 920,
    rotate: 4,
    delay: 30,
    z: 3,
  },
] as const;

const HIGHLIGHTS = [
  "End-to-end type safety (tRPC)",
  "Real-time WebSocket sync",
  "Shadcn/ui · Radix · OkLCH",
  "Discord OAuth + JWT",
];

export const WebShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [138, 162], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

  // Slow floating drift
  const drift = Math.sin(frame / 50) * 6;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/high-speed-train.webp"
        zoom={[1.06, 1.14]}
        blur={22}
        darken={0.88}
        gradient="none"
        durationInFrames={164}
      />

      <AbsoluteFill style={{ padding: "80px 100px" }}>
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
            marginBottom: 32,
            maxWidth: 900,
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
            The Web Portal
          </div>
          <h2
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: theme.foreground,
              letterSpacing: -2,
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Everything, <span style={{ color: theme.primary }}>at a glance</span>.
          </h2>
          <div
            style={{
              marginTop: 14,
              fontSize: 22,
              color: theme.mutedForeground,
            }}
          >
            Browse servers, manage your portfolio, chat with players, and moderate
            the community — all from one polished, type-safe interface.
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {HIGHLIGHTS.map((h, i) => {
              const t = spring({
                frame: frame - (24 + i * 6),
                fps,
                config: { damping: 20, stiffness: 90 },
              });
              return (
                <div
                  key={h}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    background: "rgba(30, 28, 35, 0.75)",
                    border: `1px solid ${theme.border}`,
                    color: theme.foreground,
                    fontSize: 15,
                    fontWeight: 500,
                    letterSpacing: 0.3,
                    opacity: t,
                    transform: `translateY(${(1 - t) * 10}px)`,
                  }}
                >
                  {h}
                </div>
              );
            })}
          </div>
        </div>

        {/* Browser frames */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {FRAMES.map((f, i) => {
            const inSpring = spring({
              frame: frame - f.delay,
              fps,
              config: { damping: 16, stiffness: 85 },
            });
            const yFloat = drift * (i % 2 === 0 ? 1 : -1);
            return (
              <div
                key={f.src}
                style={{
                  position: "absolute",
                  top: f.top - 120,
                  left: f.left - 80,
                  width: f.width,
                  height: f.height,
                  zIndex: f.z,
                  opacity: inSpring,
                  transform: `translate(${(1 - inSpring) * 40}px, ${yFloat}px) rotate(${f.rotate}deg) scale(${0.92 + inSpring * 0.08})`,
                  transformOrigin: "center center",
                }}
              >
                <BrowserFrame src={f.src} url={f.url} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
