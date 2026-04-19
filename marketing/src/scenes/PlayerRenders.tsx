import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { SCREENSHOTS } from "../components/assets";

// The four Puppeteer-generated player render cards the Discord bot posts
// when someone runs the matching slash command. Each tile shows the real
// rendered PNG with its command label so the scene reads as:
//   "here's what a player card looks like · this is how you get it".
const RENDERS = [
  {
    command: "/profile",
    src: SCREENSHOTS.renderProfile,
    caption: "Net worth, playtime, blocks mined, deaths",
    tilt: -2.5,
  },
  {
    command: "/top",
    src: SCREENSHOTS.renderTop,
    caption: "Podium leaderboards · any tracked metric",
    tilt: 2.5,
  },
  {
    command: "/activity",
    src: SCREENSHOTS.renderActivity,
    caption: "Contribution-graph of your session history",
    tilt: 2,
  },
  {
    command: "/compare",
    src: SCREENSHOTS.renderCompare,
    caption: "Head-to-head stats against another player",
    tilt: -2,
  },
];

export const PlayerRenders: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SCENE = 180;

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [168, 192], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/space-station.webp"
        zoom={[1.04, 1.1]}
        blur={26}
        darken={0.88}
        gradient="none"
        durationInFrames={194}
      />

      <AbsoluteFill style={{ padding: "70px 100px 60px" }}>
        {/* Header */}
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 20}px)`,
            marginBottom: 28,
            textAlign: "center",
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
            Player Cards
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
            Your stats,{" "}
            <span style={{ color: theme.primary }}>on demand</span>.
          </h2>
          <div
            style={{
              marginTop: 12,
              fontSize: 20,
              color: theme.mutedForeground,
              maxWidth: 1000,
              margin: "12px auto 0",
            }}
          >
            Server-rendered cards, posted straight into Discord whenever you
            run a slash command — profile, leaderboards, activity heatmaps,
            and head-to-head comparisons.
          </div>
        </div>

        {/* 2x2 grid of render cards */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 28,
          }}
        >
          {RENDERS.map((r, i) => {
            const delay = 16 + i * 9;
            const cardIn = spring({
              frame: frame - delay,
              fps,
              config: { damping: 17, stiffness: 95 },
            });

            // Subtle ken-burns zoom on the render so it doesn't feel static.
            const zoom = interpolate(frame, [0, SCENE], [1.0, 1.03], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={r.command}
                style={{
                  position: "relative",
                  minWidth: 0,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  opacity: cardIn,
                  transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.96 + cardIn * 0.04}) rotate(${r.tilt * (1 - cardIn) + r.tilt * 0.35 * cardIn}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* Command label — monospace, left-aligned, no pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    paddingLeft: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: theme.fontMono,
                      fontSize: 20,
                      fontWeight: 700,
                      color: theme.primary,
                      letterSpacing: 0.5,
                    }}
                  >
                    {r.command}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: theme.mutedForeground,
                      fontFamily: theme.fontMono,
                    }}
                  >
                    {r.caption}
                  </span>
                </div>

                {/* Render image with drop shadow */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 16,
                    overflow: "hidden",
                    background: theme.backgroundDeep,
                    border: `1px solid ${theme.border}`,
                    boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,185,33,0.04)",
                    position: "relative",
                  }}
                >
                  <Img
                    src={staticFile(r.src)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      transform: `scale(${zoom})`,
                    }}
                  />
                  {/* Corner glow */}
                  <div
                    style={{
                      position: "absolute",
                      top: -60,
                      right: -60,
                      width: 180,
                      height: 180,
                      borderRadius: "50%",
                      background: `radial-gradient(circle, ${theme.primarySoft} 0%, transparent 70%)`,
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
