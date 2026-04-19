import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { BrowserFrame } from "../components/BrowserFrame";
import { SCREENSHOTS } from "../components/assets";

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
    src: SCREENSHOTS.cryptoMarket,
    url: "createrington.com/crypto",
    width: 1000,
    height: 620,
    top: 220,
    left: 520,
    rotate: -3,
    delay: 18,
    z: 2,
  },
  {
    src: SCREENSHOTS.webChat,
    url: "createrington.com/chat",
    width: 900,
    height: 560,
    top: 380,
    left: 920,
    rotate: 4,
    delay: 30,
    z: 3,
  },
] as const;

export const WebShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [138, 162], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

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
            Browse servers, trade on the in-game market, chat with players
            across Minecraft and Discord, and track your playtime — all from
            one polished interface.
          </div>
        </div>

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
