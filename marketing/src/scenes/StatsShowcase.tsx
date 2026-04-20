import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Background } from "../components/Background";
import { NumberCountUp } from "../components/NumberCountUp";

const STATS = [
  {
    target: 100,
    suffix: "+",
    title: "Registered Members",
    description: "Verified community members",
  },
  {
    target: 10000,
    suffix: "+",
    title: "Hours Played",
    description: "Total playtime across all players",
  },
  {
    target: 200,
    suffix: "+",
    title: "Curated Mods",
    description: "Hand-picked for balance and performance",
  },
  {
    target: 300,
    suffix: "K+",
    title: "Mod Downloads",
    description: "Our team's published mods on Curseforge & Modrinth",
  },
];

const FIRST_STAT_AT = 16;
const STAT_DURATION = 50;

export const StatsShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [226, 250], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Background
        image="assets/hero/space-ship-station.webp"
        zoom={[1.05, 1.15]}
        blur={14}
        darken={0.86}
        gradient="both"
        durationInFrames={254}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "90px 120px 60px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * 30}px)`,
          }}
        >
          <h2
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: theme.foreground,
              letterSpacing: -1,
              margin: 0,
            }}
          >
            Join a Thriving Community
          </h2>
          <p
            style={{
              marginTop: 10,
              fontSize: 22,
              color: theme.primary,
              maxWidth: 720,
            }}
          >
            Our server is home to a vibrant community of builders and creators
          </p>
        </div>

        <div
          style={{
            flex: 1,
            width: "100%",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {STATS.map((s, i) => {
            const statStart = FIRST_STAT_AT + i * STAT_DURATION;
            const enter = interpolate(frame, [statStart, statStart + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const exit = interpolate(
              frame,
              [statStart + STAT_DURATION - 6, statStart + STAT_DURATION + 4],
              [1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const opacity = Math.min(enter, exit);
            if (opacity <= 0) return null;

            const lift = (1 - enter) * 40 - (1 - exit) * 40;

            return (
              <div
                key={s.title}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity,
                  transform: `translateY(${lift}px)`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: 640,
                    height: 640,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${theme.primaryGlow} 0%, transparent 62%)`,
                    filter: "blur(24px)",
                    opacity: 0.9 * enter,
                    pointerEvents: "none",
                  }}
                />

                <NumberCountUp
                  to={s.target}
                  delay={statStart + 2}
                  durationInFrames={22}
                  suffix={s.suffix}
                  style={{
                    fontSize: 260,
                    fontWeight: 800,
                    color: theme.foreground,
                    letterSpacing: -8,
                    lineHeight: 1,
                    textShadow: `0 0 80px ${theme.primaryGlow}, 0 0 20px rgba(0,0,0,0.6)`,
                    zIndex: 1,
                  }}
                />

                <div
                  style={{
                    marginTop: 24,
                    fontSize: 44,
                    fontWeight: 700,
                    color: theme.foreground,
                    letterSpacing: -0.5,
                    zIndex: 1,
                    textShadow: "0 2px 12px rgba(0,0,0,0.7)",
                  }}
                >
                  {s.title}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 22,
                    color: theme.mutedForeground,
                    maxWidth: 620,
                    textAlign: "center",
                    lineHeight: 1.4,
                    zIndex: 1,
                  }}
                >
                  {s.description}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            paddingBottom: 10,
          }}
        >
          {STATS.map((_, i) => {
            const statStart = FIRST_STAT_AT + i * STAT_DURATION;
            const active = interpolate(
              frame,
              [statStart - 2, statStart + 6, statStart + STAT_DURATION - 2, statStart + STAT_DURATION + 4],
              [0, 1, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return (
              <div
                key={i}
                style={{
                  width: 48,
                  height: 4,
                  borderRadius: 2,
                  background: `rgba(255,255,255,${0.1 + active * 0.1})`,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: theme.primary,
                    transform: `scaleX(${active})`,
                    transformOrigin: "left center",
                    boxShadow: `0 0 12px ${theme.primaryGlow}`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
